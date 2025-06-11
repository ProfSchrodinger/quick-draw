#!/usr/bin/env python3
"""
Quick Draw Classifier Web Interface
----------------------------------
A Flask web application that provides a drawing interface for the Quick Draw classifier.
Users can draw sketches that are sent to the trained model for classification.
"""

import os
import json
import base64
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
from flask import Flask, render_template, request, jsonify

# Initialize Flask app
app = Flask(__name__)

# Global variables to store model and class names
model = None
class_names = []

def load_model_and_classes():
    """
    Load the trained model and class names from files.
    
    Returns:
        tuple: (model, class_names)
    """
    global model, class_names
    
    try:
        # Load the model
        model_path = os.path.join("models", "quick_draw_model")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        model = tf.keras.models.load_model(model_path)
        
        # Load class names
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


def preprocess_image(image_data):
    """
    Preprocess the image data to match the format expected by the model.
    
    Args:
        image_data (str): Base64 encoded image data
        
    Returns:
        numpy.ndarray: Preprocessed image as a numpy array
    """
    try:
        # Remove the data URL prefix
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to grayscale
        image = image.convert("L")
        
        # Resize to 28x28
        image = image.resize((28, 28))
        
        # Invert colors (black background to white background)
        image = Image.fromarray(255 - np.array(image))
        
        # Convert to numpy array and normalize
        img_array = np.array(image).astype("float32") / 255.0
        
        # Reshape for model input (add batch and channel dimensions)
        img_array = img_array.reshape(1, 28, 28, 1)
        
        return img_array
    
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None


def get_predictions(img_array):
    """
    Get predictions from the model for the given image.
    
    Args:
        img_array (numpy.ndarray): Preprocessed image array
        
    Returns:
        list: List of (class_name, probability) tuples sorted by probability
    """
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
    """Serve the main page with the drawing interface."""
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    """
    Endpoint to receive drawing data and return predictions.
    
    Expects JSON with:
        - image_data: Base64 encoded image data
        
    Returns:
        JSON with:
        - success: Boolean indicating success
        - predictions: List of prediction results
        - error: Error message if any
    """
    try:
        # Get image data from request
        data = request.get_json()
        if not data or 'image_data' not in data:
            return jsonify({
                'success': False,
                'error': 'No image data provided'
            }), 400
        
        image_data = data['image_data']
        
        # Preprocess image
        img_array = preprocess_image(image_data)
        if img_array is None:
            return jsonify({
                'success': False,
                'error': 'Error preprocessing image'
            }), 400
        
        # Get predictions
        predictions = get_predictions(img_array)
        
        return jsonify({
            'success': True,
            'predictions': predictions
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.before_first_request
def initialize():
    """Load model and class names before the first request."""
    global model, class_names
    model, class_names = load_model_and_classes()
    if model is None:
        print("WARNING: Model could not be loaded. Predictions will not work.")


if __name__ == '__main__':
    # Make sure the template directory exists
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    if not os.path.exists(template_dir):
        os.makedirs(template_dir)
        print(f"Created template directory: {template_dir}")
    
    # Load model and class names
    model, class_names = load_model_and_classes()
    
    # Run the Flask app
    app.run(debug=True)
