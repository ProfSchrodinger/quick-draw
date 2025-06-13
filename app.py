import os
import json
import random
import base64
import numpy as np
from io import BytesIO
import cv2  
from PIL import Image, ImageOps
import tensorflow as tf
import tensorflow as tf
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__, 
            static_url_path='/static', 
            static_folder='static',
            template_folder='templates')

# Global variables to store model and class names
model = None
class_names = []
current_sessions = {} 

def load_model_and_classes():
    global model, class_names
    
    try:
        model_path = os.path.join("models", "quick_draw_model.h5")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        model = tf.keras.models.load_model(model_path)
        
        
        class_file = os.path.join("data", "selected_classes.json")
        if not os.path.exists(class_file):
            raise FileNotFoundError(f"Class names file not found at {class_file}")
        with open(class_file, 'r') as f:
            class_names = json.load(f)
        
        print(f"Model loaded successfully. Number of classes: {len(class_names)}")
        return model, class_names
    
    except Exception as e:
        print(f"Error loading model or class names: {e}")
        return None, []

model, class_names = load_model_and_classes()
if model is None:
    print("WARNING: Model could not be loaded. Predictions will not work.")

def preprocess_image(image_data):
    try:
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        image = image.convert("L")
        image = image.resize((28, 28), Image.LANCZOS)
        img_array = np.array(image)
        
        print(f"Image min: {img_array.min()}, max: {img_array.max()}")
        if img_array.mean() < 128:
            img_array = 255 - img_array
            
        img_array = img_array.astype("float32") / 255.0
        img_array = 1.0 - img_array
        img_array = img_array.reshape(1, 28, 28, 1)
        
        if not os.path.exists('debug'):
            os.makedirs('debug')
        debug_img = Image.fromarray((img_array[0, :, :, 0] * 255).astype(np.uint8))
        debug_img.save('debug/last_processed_image.png')
        
        return img_array
    
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None


def get_predictions(img_array):
    try:
        if model is None:
            raise ValueError("Model not loaded")
        
        # Get predictions
        predictions = model.predict(img_array)[0]
        
        # Get top 5 predictions
        top_indices = predictions.argsort()[-5:][::-1]
        
        results = []
        for i in top_indices:
            results.append({
                "class": class_names[i],
                "probability": float(predictions[i])
            })
        
        return results
    
    except Exception as e:
        print(f"Error getting predictions: {e}")
        return []


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/game')
def game():
    return render_template('game.html')


@app.route('/get_random_class', methods=['GET'])
def get_random_class():
    try:
        if not class_names:
            return jsonify({
                'success': False,
                'error': 'Class names not loaded'
            }), 500
        
        target_class = random.choice(class_names)
        session_id = str(random.randint(10000, 99999))
        current_sessions[session_id] = {
            'target_class': target_class,
            'timestamp': import_time()
        }
        
        return jsonify({
            'success': True,
            'class_name': target_class,
            'session_id': session_id
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/submit_drawing', methods=['POST'])
def submit_drawing():
    try:
        data = request.get_json()
        if not data or 'image_data' not in data or 'session_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image data or session ID'
            }), 400
        
        image_data = data['image_data']
        session_id = data['session_id']
        
        if session_id not in current_sessions:
            return jsonify({
                'success': False,
                'error': 'Invalid or expired session ID'
            }), 400
        
        target_class = current_sessions[session_id]['target_class']
        
        clean_old_sessions()
    
        img_array = preprocess_image(image_data)
        if img_array is None:
            return jsonify({
                'success': False,
                'error': 'Error preprocessing image'
            }), 400
        
        print(img_array)
        
        predictions = get_predictions(img_array)
        if not predictions:
            return jsonify({
                'success': False,
                'error': 'Error getting predictions'
            }), 500
        
        top_prediction = predictions[0]['class']
        is_match = (top_prediction == target_class)
        
        return jsonify({
            'success': True,
            'match': is_match,
            'predictions': predictions,
            'target_class': target_class
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def clean_old_sessions():
    import time
    current_time = time.time()
    expired_sessions = []
    
    for session_id, session_data in current_sessions.items():
        if current_time - session_data.get('timestamp', 0) > 300:
            expired_sessions.append(session_id)
    
    for session_id in expired_sessions:
        del current_sessions[session_id]


def import_time():
    import time
    return time.time()
    


if __name__ == '__main__':
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    
    for directory in [template_dir, static_dir]:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Created directory: {directory}")
            
    app.run(debug=True)