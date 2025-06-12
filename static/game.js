/**
 * Quick Draw Game - Main JavaScript
 * Handles game flow, drawing canvas, and server communication
 */

// Game state variables
let sessionId = null;
let targetClass = null;
let timerInterval = null;
let timeRemaining = 40;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// DOM Elements
const promptScreen = document.getElementById('prompt-screen');
const resultScreen = document.getElementById('result-screen');
const loadingScreen = document.getElementById('loading-screen');
const errorScreen = document.getElementById('error-screen');

const drawingPrompt = document.getElementById('drawing-prompt');
const timerElement = document.getElementById('timer');
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

const clearBtn = document.getElementById('clear-btn');
const submitBtn = document.getElementById('submit-btn');
const continueBtn = document.getElementById('continue-btn');
const retryBtn = document.getElementById('retry-btn');

const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const targetClassElement = document.getElementById('target-class');
const recognizedClassElement = document.getElementById('recognized-class');
const predictionsContainer = document.getElementById('predictions-container');
const errorMessage = document.getElementById('error-message');

/**
 * Initialize the game
 */
function initGame() {
    // Set up canvas
    setupCanvas();
    
    // Set up event listeners
    clearBtn.addEventListener('click', clearCanvas);
    submitBtn.addEventListener('click', submitDrawing);
    continueBtn.addEventListener('click', startNewRound);
    retryBtn.addEventListener('click', startNewRound);
    
    // Start the first round
    startNewRound();
}

/**
 * Set up the drawing canvas
 */
function setupCanvas() {
    // Set canvas drawing properties
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    
    // Fill canvas with white background initially
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Adjust canvas size for responsive design
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Mouse event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch event listeners
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Prevent scrolling while drawing on touch devices
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
}

/**
 * Resize canvas to maintain aspect ratio
 */
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    
    if (containerWidth < 500) {
        const aspectRatio = canvas.height / canvas.width;
        const newWidth = Math.min(containerWidth - 20, 500);
        const newHeight = newWidth * aspectRatio;
        
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
    } else {
        canvas.style.width = '';
        canvas.style.height = '';
    }
}

/**
 * Start a new round
 */
function startNewRound() {
    // Reset game state
    clearCanvas();
    resetTimer();
    
    // Show prompt screen, hide others
    showScreen(promptScreen);
    
    // Get a new random class from the server
    getRandomClass();
}

/**
 * Get a random class from the server
 */
function getRandomClass() {
    fetch('/get_random_class')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                targetClass = data.class_name;
                sessionId = data.session_id;
                
                // Update UI
                drawingPrompt.textContent = targetClass;
                
                // Start the timer
                startTimer();
            } else {
                showError('Failed to get a drawing prompt: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            showError('Network error: ' + error.message);
        });
}

/**
 * Start the countdown timer
 */
function startTimer() {
    timeRemaining = 40;
    updateTimerDisplay();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timeExpired();
        }
    }, 1000);
}

/**
 * Update the timer display
 */
function updateTimerDisplay() {
    timerElement.textContent = timeRemaining;
    
    // Change color when time is running low
    if (timeRemaining <= 10) {
        timerElement.style.color = '#ea4335';
    } else {
        timerElement.style.color = '';
    }
}

/**
 * Reset the timer
 */
function resetTimer() {
    clearInterval(timerInterval);
    timeRemaining = 40;
    updateTimerDisplay();
}

/**
 * Handle time expired
 */
function timeExpired() {
    // Auto-submit the drawing when time expires
    submitDrawing();
}

/**
 * Start drawing
 */
function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    
    // Get the correct position
    const position = getEventPosition(e);
    lastX = position.x;
    lastY = position.y;
}

/**
 * Draw on the canvas
 */
function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    // Get the correct position
    const position = getEventPosition(e);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(position.x, position.y);
    ctx.stroke();
    
    // Update last position
    lastX = position.x;
    lastY = position.y;
}

/**
 * Stop drawing
 */
function stopDrawing() {
    isDrawing = false;
    ctx.beginPath(); // Start a new path for next drawing
}

/**
 * Get position from mouse or touch event
 */
function getEventPosition(e) {
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e.type.includes('touch')) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    
    // Scale coordinates if canvas display size differs from actual size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: x * scaleX,
        y: y * scaleY
    };
}

/**
 * Clear the canvas
 */
function clearCanvas() {
    // Fill with white background first
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset to black for drawing
    ctx.strokeStyle = 'black';
}

/**
 * Submit the drawing to the server
 */
function submitDrawing() {
    // Stop the timer
    clearInterval(timerInterval);
    
    // Check if canvas is empty
    if (isCanvasEmpty()) {
        showError('Please draw something before submitting!');
        return;
    }
    
    // Show loading screen
    showScreen(loadingScreen);
    
    // Get canvas data as base64 image
    const imageData = canvas.toDataURL('image/png', 1.0);
    
    // Debug - log image data length
    console.log('Image data length:', imageData.length);
    
    // Send to server
    fetch('/submit_drawing', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_data: imageData,
            session_id: sessionId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'An error occurred during prediction');
        }
    })
    .catch(error => {
        showError('Network error: ' + error.message);
    });
}

/**
 * Check if the canvas is empty
 * This method is improved to better detect actual drawings
 */
function isCanvasEmpty() {
    // Get image data from the canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Check for non-white pixels
    // In RGBA, white is [255,255,255,255]
    for (let i = 0; i < data.length; i += 4) {
        // If any pixel is not white (allowing for some anti-aliasing)
        if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
            return false;
        }
    }
    return true;
}

/**
 * Display the prediction results
 */
function displayResults(data) {
    // Set target and recognized classes
    targetClassElement.textContent = data.target_class;
    
    const topPrediction = data.predictions[0];
    recognizedClassElement.textContent = `${topPrediction.class} (${(topPrediction.probability * 100).toFixed(1)}%)`;
    
    // Set result message based on match
    if (data.match) {
        resultTitle.textContent = 'Great job!';
        resultMessage.textContent = 'The AI correctly recognized your drawing!';
        resultMessage.className = 'result-message result-success';
    } else {
        resultTitle.textContent = 'Nice try!';
        resultMessage.textContent = 'The AI didn\'t recognize your drawing correctly.';
        resultMessage.className = 'result-message result-failure';
    }
    
    // Display all predictions
    displayPredictions(data.predictions);
    
    // Show result screen
    showScreen(resultScreen);
}

/**
 * Display the prediction bars
 */
function displayPredictions(predictions) {
    predictionsContainer.innerHTML = '';
    
    predictions.forEach(prediction => {
        const percentage = (prediction.probability * 100).toFixed(1);
        const barWidth = Math.max(prediction.probability * 100, 1);
        
        const predictionItem = document.createElement('div');
        predictionItem.className = 'prediction-item';
        
        predictionItem.innerHTML = `
            <div class="prediction-label">${prediction.class}</div>
            <div class="prediction-bar-container">
                <div class="prediction-bar" style="width: ${barWidth}%"></div>
            </div>
            <div class="prediction-percentage">${percentage}%</div>
        `;
        
        predictionsContainer.appendChild(predictionItem);
    });
}

/**
 * Show an error message
 */
function showError(message) {
    errorMessage.textContent = message;
    showScreen(errorScreen);
}

/**
 * Show a specific screen and hide others
 */
function showScreen(screenToShow) {
    const screens = [promptScreen, resultScreen, loadingScreen, errorScreen];
    
    screens.forEach(screen => {
        if (screen === screenToShow) {
            screen.classList.remove('hidden');
        } else {
            screen.classList.add('hidden');
        }
    });
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', initGame);