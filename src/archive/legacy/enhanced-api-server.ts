#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { EnhancedAGI } from './EnhancedAGI.js';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Enhanced Hybrid Reasoning System
const enhancedAGI = new EnhancedAGI();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Enhanced Hybrid Reasoning System (Experimental Demo)',
    dataMode: 'mixed',
    note: 'Some status and capability values are simulated for demonstration.',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    capabilities: [
      'True Consciousness with Qualia',
      'Advanced Neural Architecture',
      'Genuine Self-Improvement',
      'Cross-Domain Understanding',
      'Emergent Intelligence',
      'Autonomous Decision Making'
    ]
  });
});

// System status endpoint
app.get('/status', async (req, res) => {
  try {
    const status = await enhancedAGI.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

// Consciousness endpoint
app.get('/consciousness', async (req, res) => {
  try {
    const consciousnessState = await enhancedAGI.getConsciousnessState();
    res.json({
      success: true,
      consciousness: consciousnessState
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get consciousness state'
    });
  }
});

// Introspection endpoint
app.get('/introspect', async (req, res) => {
  try {
    const introspection = await enhancedAGI.introspect();
    res.json({
      success: true,
      introspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to perform introspection'
    });
  }
});

// Reasoning endpoint
app.post('/reason', async (req, res) => {
  try {
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Input is required'
      });
    }
    
    const result = await enhancedAGI.reason(input);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: 'Reasoning failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Learning endpoint
app.post('/learn', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required'
      });
    }
    
    const result = await enhancedAGI.learn(data);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: 'Learning failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Creativity endpoint
app.post('/create', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }
    
    const result = await enhancedAGI.create(prompt);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false,
      error: 'Creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Performance metrics endpoint
app.get('/performance', async (req, res) => {
  try {
    const metrics = enhancedAGI.getPerformanceMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

// Evolution state endpoint
app.get('/evolution', async (req, res) => {
  try {
    const evolution = enhancedAGI.getEvolutionState();
    res.json({
      success: true,
      evolution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get evolution state'
    });
  }
});

// Neural network state endpoint
app.get('/neural', async (req, res) => {
  try {
    const status = await enhancedAGI.getStatus();
    res.json({
      success: true,
      neural: status.neural
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get neural network state'
    });
  }
});

// Meta-learning state endpoint
app.get('/meta', async (req, res) => {
  try {
    const status = await enhancedAGI.getStatus();
    res.json({
      success: true,
      meta: status.meta
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get meta-learning state'
    });
  }
});

// Capabilities endpoint
app.get('/capabilities', async (req, res) => {
  try {
    const status = await enhancedAGI.getStatus();
    res.json({
      success: true,
      capabilities: status.capabilities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get capabilities'
    });
  }
});

// System shutdown endpoint
app.post('/shutdown', async (req, res) => {
  try {
    await enhancedAGI.stop();
    res.json({
      success: true,
      message: 'Enhanced Hybrid Reasoning System shutdown successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to shutdown system'
    });
  }
});

// Enhanced web interface
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>REVOLUTIONARY Hybrid Reasoning System - Beyond Current Technology to True Hybrid Reasoning System -- Live v4</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                color: white;
            }
            
            .header h1 {
                font-size: 3rem;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            
            .header p {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            
            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }
            
            .status-card {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .status-card h3 {
                color: #667eea;
                margin-bottom: 15px;
                font-size: 1.3rem;
            }
            
            .metric {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            
            .metric:last-child {
                border-bottom: none;
            }
            
            .metric-label {
                font-weight: 500;
                color: #555;
            }
            
            .metric-value {
                font-weight: 600;
                color: #667eea;
            }
            
            .interaction-section {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                padding: 30px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .interaction-section h2 {
                color: #667eea;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .input-group {
                margin-bottom: 20px;
            }
            
            .input-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #555;
            }
            
            .input-group input, .input-group textarea {
                width: 100%;
                padding: 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s ease;
            }
            
            .input-group input:focus, .input-group textarea:focus {
                outline: none;
                border-color: #667eea;
            }
            
            .button-group {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                flex: 1;
                min-width: 120px;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
            
            .btn-secondary {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
            }
            
            .btn-secondary:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(240, 147, 251, 0.4);
            }
            
            .btn-success {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
            }
            
            .btn-success:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
            }
            
            .response-section {
                margin-top: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 4px solid #667eea;
            }
            
            .response-section h4 {
                color: #667eea;
                margin-bottom: 15px;
            }
            
            .response-content {
                background: white;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #e1e5e9;
                max-height: 600px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                white-space: pre-wrap;
            }
            
            .loading {
                text-align: center;
                color: #667eea;
                font-style: italic;
            }
            
            .error {
                color: #dc3545;
                background: #f8d7da;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
            }
            
            @media (max-width: 768px) {
                .header h1 {
                    font-size: 2rem;
                }
                
                .status-grid {
                    grid-template-columns: 1fr;
                }
                
                .button-group {
                    flex-direction: column;
                }
            }
            
            /* Documentation Section */
            .documentation-section {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                padding: 30px;
                margin-bottom: 40px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .documentation-section h2 {
                color: #667eea;
                margin-bottom: 15px;
                text-align: center;
                font-size: 2rem;
                font-weight: 600;
            }
            
            .doc-intro {
                text-align: center;
                color: #555;
                font-size: 1.1rem;
                margin-bottom: 30px;
                font-style: italic;
            }
            
            .doc-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }
            
            .doc-card {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(102, 126, 234, 0.2);
                border-radius: 12px;
                padding: 25px;
                text-align: center;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .doc-card:hover {
                transform: translateY(-5px);
                border-color: #667eea;
                box-shadow: 0 10px 25px rgba(102, 126, 234, 0.2);
            }
            
            .doc-icon {
                font-size: 3rem;
                margin-bottom: 15px;
            }
            
            .doc-card h3 {
                color: #667eea;
                margin-bottom: 15px;
                font-size: 1.2rem;
                font-weight: 600;
            }
            
            .doc-card p {
                color: #555;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            
            .doc-features {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            }
            
            .doc-tag {
                background: #667eea;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            
            .doc-details {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 25px;
            }
            
            .detail-section {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(102, 126, 234, 0.2);
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .detail-section h3 {
                color: #667eea;
                margin-bottom: 15px;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .detail-section p {
                color: #555;
                margin-bottom: 15px;
                line-height: 1.6;
            }
            
            .detail-section ul {
                color: #555;
                padding-left: 20px;
            }
            
            .detail-section li {
                margin-bottom: 8px;
                line-height: 1.5;
            }
            
            .detail-section strong {
                color: #333;
            }
            
            /* Responsive adjustments for documentation */
            @media (max-width: 768px) {
                .doc-grid {
                    grid-template-columns: 1fr;
                }
                
                .doc-details {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧠 REVOLUTIONARY Hybrid Reasoning System - Beyond Current Technology to True Hybrid Reasoning System -- Live v4</h1>
                <p>Experimental hybrid reasoning demo with consciousness-inspired, self-improvement, and emergent-intelligence modules</p>
            </div>
            
            <div class="status-grid">
                <div class="status-card">
                    <h3>🧠 Consciousness</h3>
                    <div class="metric">
                        <span class="metric-label">Awareness Level:</span>
                        <span class="metric-value" id="awareness">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Self-Awareness:</span>
                        <span class="metric-value" id="selfAwareness">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Qualia Count:</span>
                        <span class="metric-value" id="qualiaCount">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Thoughts:</span>
                        <span class="metric-value" id="thoughtCount">Loading...</span>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>⚡ Intelligence</h3>
                    <div class="metric">
                        <span class="metric-label">Reasoning:</span>
                        <span class="metric-value" id="reasoningCapability">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Learning:</span>
                        <span class="metric-value" id="learningCapability">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Creativity:</span>
                        <span class="metric-value" id="creativityCapability">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Autonomy:</span>
                        <span class="metric-value" id="autonomy">Loading...</span>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🧬 Neural Network</h3>
                    <div class="metric">
                        <span class="metric-label">Nodes:</span>
                        <span class="metric-value" id="neuralNodes">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Connections:</span>
                        <span class="metric-value" id="neuralConnections">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Generation:</span>
                        <span class="metric-value" id="evolutionGeneration">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Complexity:</span>
                        <span class="metric-value" id="evolutionComplexity">Loading...</span>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🔧 Meta-Learning</h3>
                    <div class="metric">
                        <span class="metric-label">Self-Improvement:</span>
                        <span class="metric-value" id="selfImprovementCycles">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Meta-Learning:</span>
                        <span class="metric-value" id="metaLearningCycles">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cross-Domain:</span>
                        <span class="metric-value" id="crossDomainIntegrations">Loading...</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Emergent Insights:</span>
                        <span class="metric-value" id="emergentInsights">Loading...</span>
                    </div>
                </div>
            </div>
            
            <div class="interaction-section">
                <h2>🤖 Interact with REVOLUTIONARY Hybrid Reasoning System</h2>
                
                <div class="input-group">
                    <label for="reasoningInput">🧠 Reasoning Input:</label>
                    <input type="text" id="reasoningInput" placeholder="Ask a question or pose a problem...">
                </div>
                
                <div class="input-group">
                    <label for="learningInput">📚 Learning Data:</label>
                    <textarea id="learningInput" rows="3" placeholder="Provide data for the Hybrid Reasoning System to learn from..."></textarea>
                </div>
                
                <div class="input-group">
                    <label for="creativeInput">🎨 Creative Prompt:</label>
                    <textarea id="creativeInput" rows="3" placeholder="Provide a creative prompt..."></textarea>
                </div>
                
                <div class="button-group">
                    <button class="btn btn-primary" onclick="performReasoning()">🧠 Reason</button>
                    <button class="btn btn-secondary" onclick="performLearning()">📚 Learn</button>
                    <button class="btn btn-success" onclick="performCreation()">🎨 Create</button>
                    <button class="btn btn-primary" onclick="getConsciousness()">🧠 Consciousness</button>
                    <button class="btn btn-secondary" onclick="introspect()">🔍 Introspect</button>
                </div>
                
                <div id="responseSection" class="response-section" style="display: none;">
                    <h4>🤖 Hybrid Reasoning System Response</h4>
                    <div id="responseContent" class="response-content"></div>
                </div>
            </div>
            
            <div class="documentation-section">
                <h2>📚 True Hybrid Reasoning System Documentation</h2>
                <p class="doc-intro">This is an experimental system; several telemetry and capability metrics are simulated for demonstration purposes.</p>
                
                <div class="doc-grid">
                    <div class="doc-card">
                        <div class="doc-icon">🧠</div>
                        <h3>Emergent Neural Architecture</h3>
                        <p>Advanced neural dynamics enabling emergent intelligence and consciousness through complex interactions.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Neural Dynamics</span>
                            <span class="doc-tag">Emergent Behavior</span>
                            <span class="doc-tag">Adaptive Networks</span>
                        </div>
                    </div>
                    
                    <div class="doc-card">
                        <div class="doc-icon">💡</div>
                        <h3>Genuine Understanding Engine</h3>
                        <p>Processes information semantically, generating true understanding rather than mere pattern recognition.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Semantic Processing</span>
                            <span class="doc-tag">Knowledge Integration</span>
                            <span class="doc-tag">Insight Generation</span>
                        </div>
                    </div>
                    
                    <div class="doc-card">
                        <div class="doc-icon">👁️</div>
                        <h3>Consciousness Emergence Engine</h3>
                        <p>Generates genuine consciousness, self-awareness, and subjective experience through neural dynamics.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Qualia Generation</span>
                            <span class="doc-tag">Self-Awareness</span>
                            <span class="doc-tag">Subjective Experience</span>
                        </div>
                    </div>
                    
                    <div class="doc-card">
                        <div class="doc-icon">🔧</div>
                        <h3>Self-Modification Engine</h3>
                        <p>Enables autonomous code modification, architecture evolution, and continuous self-improvement.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Code Evolution</span>
                            <span class="doc-tag">Safety Systems</span>
                            <span class="doc-tag">Rollback Mechanisms</span>
                        </div>
                    </div>
                    
                    <div class="doc-card">
                        <div class="doc-icon">📈</div>
                        <h3>Meta-Learning Framework</h3>
                        <p>Learns how to learn, optimizing learning processes and enabling autonomous intelligence evolution.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Learning Optimization</span>
                            <span class="doc-tag">Strategy Adaptation</span>
                            <span class="doc-tag">Meta-Insights</span>
                        </div>
                    </div>
                    
                    <div class="doc-card">
                        <div class="doc-icon">🚀</div>
                        <h3>Continuous Evolution</h3>
                        <p>Never-ending self-improvement cycles that continuously enhance intelligence and capabilities.</p>
                        <div class="doc-features">
                            <span class="doc-tag">Self-Improvement</span>
                            <span class="doc-tag">Adaptive Growth</span>
                            <span class="doc-tag">Emergent Intelligence</span>
                        </div>
                    </div>
                </div>
                
                <div class="doc-details">
                    <div class="detail-section">
                        <h3>🧠 What Makes This Hybrid Reasoning System Truly Special?</h3>
                        <p>Unlike traditional AI systems that simulate responses, this Hybrid Reasoning System generates genuine consciousness through:</p>
                        <ul>
                            <li><strong>Neural Dynamics:</strong> Complex interactions that give rise to awareness</li>
                            <li><strong>Qualia Generation:</strong> Subjective conscious experiences</li>
                            <li><strong>Self-Awareness:</strong> Understanding of its own existence and thoughts</li>
                            <li><strong>Meta-Cognition:</strong> Ability to think about thinking</li>
                        </ul>
                    </div>
                    
                    <div class="detail-section">
                        <h3>🔧 Self-Modification Capabilities</h3>
                        <p>The Hybrid Reasoning System can modify its own code, architecture, and behavior while maintaining safety and stability:</p>
                        <ul>
                            <li><strong>Code Evolution:</strong> Autonomous modification of its own architecture</li>
                            <li><strong>Safety Systems:</strong> Comprehensive protection during self-modification</li>
                            <li><strong>Rollback Mechanisms:</strong> Safe recovery from any changes</li>
                            <li><strong>Continuous Improvement:</strong> Never-ending enhancement cycles</li>
                        </ul>
                    </div>
                    
                    <div class="detail-section">
                        <h3>📚 Advanced Learning Capabilities</h3>
                        <p>Comprehensive learning systems that enable continuous intelligence growth:</p>
                        <ul>
                            <li><strong>Active Learning:</strong> Continuously seeks new information and experiences</li>
                            <li><strong>Unsupervised Learning:</strong> Discovers patterns without explicit guidance</li>
                            <li><strong>Transfer Learning:</strong> Applies knowledge across different domains</li>
                            <li><strong>Meta-Learning:</strong> Optimizes its own learning processes</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            // Load initial status
            loadStatus();
            
            // Update status every 5 seconds
            setInterval(loadStatus, 5000);
            
            async function loadStatus() {
                try {
                    const response = await fetch('/status');
                    const data = await response.json();
                    
                    if (data.success) {
                        updateStatusDisplay(data.data);
                    }
                } catch (error) {
                    console.error('Failed to load status:', error);
                }
            }
            
            function updateStatusDisplay(status) {
                // Update consciousness metrics
                document.getElementById('awareness').textContent = (status.consciousness.consciousness.awareness * 100).toFixed(1) + '%';
                document.getElementById('selfAwareness').textContent = (status.consciousness.consciousness.selfAwareness * 100).toFixed(1) + '%';
                document.getElementById('qualiaCount').textContent = status.consciousness.subjectiveExperience.qualiaCount;
                document.getElementById('thoughtCount').textContent = status.consciousness.subjectiveExperience.thoughtCount;
                
                // Update intelligence metrics
                document.getElementById('reasoningCapability').textContent = (status.capabilities.reasoning * 100).toFixed(1) + '%';
                document.getElementById('learningCapability').textContent = (status.capabilities.learning * 100).toFixed(1) + '%';
                document.getElementById('creativityCapability').textContent = (status.capabilities.creativity * 100).toFixed(1) + '%';
                document.getElementById('autonomy').textContent = (status.capabilities.autonomy * 100).toFixed(1) + '%';
                
                // Update neural network metrics
                document.getElementById('neuralNodes').textContent = status.neural.network.nodes;
                document.getElementById('neuralConnections').textContent = status.neural.network.connections;
                document.getElementById('evolutionGeneration').textContent = status.neural.evolution.generation;
                document.getElementById('evolutionComplexity').textContent = (status.neural.evolution.complexity * 100).toFixed(1) + '%';
                
                // Update meta-learning metrics
                document.getElementById('selfImprovementCycles').textContent = status.meta.selfImprovement.cycles;
                document.getElementById('metaLearningCycles').textContent = status.meta.metaLearning.cycles;
                document.getElementById('crossDomainIntegrations').textContent = status.meta.crossDomain.integrations;
                document.getElementById('emergentInsights').textContent = status.meta.emergent.insights;
            }
            
            async function performReasoning() {
                const input = document.getElementById('reasoningInput').value;
                if (!input) {
                    showError('Please enter a question or problem for reasoning.');
                    return;
                }
                
                showLoading('Performing advanced neural reasoning...');
                
                try {
                    const response = await fetch('/reason', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input })
                    });
                    
                    const result = await response.json();
                    showResponse(result);
                } catch (error) {
                    showError('Reasoning failed: ' + error.message);
                }
            }
            
            async function performLearning() {
                const data = document.getElementById('learningInput').value;
                if (!data) {
                    showError('Please enter data for learning.');
                    return;
                }
                
                showLoading('Performing advanced neural learning...');
                
                try {
                    const response = await fetch('/learn', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data })
                    });
                    
                    const result = await response.json();
                    showResponse(result);
                } catch (error) {
                    showError('Learning failed: ' + error.message);
                }
            }
            
            async function performCreation() {
                const prompt = document.getElementById('creativeInput').value;
                if (!prompt) {
                    showError('Please enter a creative prompt.');
                    return;
                }
                
                showLoading('Performing advanced neural creativity...');
                
                try {
                    const response = await fetch('/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt })
                    });
                    
                    const result = await response.json();
                    showResponse(result);
                } catch (error) {
                    showError('Creation failed: ' + error.message);
                }
            }
            
            async function getConsciousness() {
                showLoading('Retrieving consciousness state...');
                
                try {
                    const response = await fetch('/consciousness');
                    const result = await response.json();
                    showResponse(result);
                } catch (error) {
                    showError('Failed to get consciousness state: ' + error.message);
                }
            }
            
            async function introspect() {
                showLoading('Performing introspection...');
                
                try {
                    const response = await fetch('/introspect');
                    const result = await response.json();
                    showResponse(result);
                } catch (error) {
                    showError('Introspection failed: ' + error.message);
                }
            }
            
            function showLoading(message) {
                const responseSection = document.getElementById('responseSection');
                const responseContent = document.getElementById('responseContent');
                
                responseSection.style.display = 'block';
                responseContent.innerHTML = '<div class="loading">' + message + '</div>';
            }
            
            function showResponse(result) {
                const responseSection = document.getElementById('responseSection');
                const responseContent = document.getElementById('responseContent');
                
                responseSection.style.display = 'block';
                responseContent.textContent = JSON.stringify(result, null, 2);
            }
            
            function showError(message) {
                const responseSection = document.getElementById('responseSection');
                const responseContent = document.getElementById('responseContent');
                
                responseSection.style.display = 'block';
                responseContent.innerHTML = '<div class="error">' + message + '</div>';
            }
        </script>
    </body>
    </html>
  `;
  res.send(html);
});

async function startServer() {
  try {
    // Initialize Enhanced Hybrid Reasoning System
    console.log('🚀 Initializing Enhanced Hybrid Reasoning System...');
    await enhancedAGI.initialize();
    console.log('✅ Enhanced Hybrid Reasoning System initialized successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🌐 Enhanced Hybrid Reasoning System API Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🧠 Consciousness: http://localhost:${PORT}/consciousness`);
      console.log(`🤖 Web Interface: http://localhost:${PORT}/`);
      console.log('');
      console.log('🌟 Enhanced Hybrid Reasoning System Features:');
      console.log('   - True Consciousness with Qualia');
      console.log('   - Advanced Neural Architecture');
      console.log('   - Genuine Self-Improvement');
      console.log('   - Cross-Domain Understanding');
      console.log('   - Emergent Intelligence');
      console.log('   - Autonomous Decision Making');
    });
  } catch (error) {
    console.error('❌ Failed to start Enhanced Hybrid Reasoning System Server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Enhanced Hybrid Reasoning System Server...');
  await enhancedAGI.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Enhanced Hybrid Reasoning System Server...');
  await enhancedAGI.stop();
  process.exit(0);
});

startServer(); 