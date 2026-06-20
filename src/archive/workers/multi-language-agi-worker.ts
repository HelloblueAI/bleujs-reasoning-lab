/**
 * Multi-Language AGI Worker
 * The most advanced AGI system in the world, combining Rust, C, TypeScript, and WebAssembly
 */

import MultiLanguageAGI from './multi-language-agi';

// Initialize the multi-language AGI system
const multiLanguageAGI = new MultiLanguageAGI();

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Initialize AGI system if not already done
    if (!multiLanguageAGI.isInitialized) {
      try {
        await multiLanguageAGI.initialize();
      } catch (error) {
        console.error('Failed to initialize multi-language AGI:', error);
      }
    }

    // API endpoints
    if (url.pathname === '/api/v1/multi-language-agi/status') {
      const metrics = multiLanguageAGI.getSystemMetrics();
      return new Response(JSON.stringify({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (url.pathname === '/api/v1/multi-language-agi/process') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const body = await request.json();
        const response = await multiLanguageAGI.processInput({
          text: body.text || 'Hello, I am the most advanced AGI system in the world!',
          options: {
            useRust: body.useRust !== false,
            useC: body.useC !== false,
            useWasm: body.useWasm !== false,
            useAssembly: body.useAssembly !== false,
            parallel: body.parallel !== false,
            timeout: body.timeout || 30000
          }
        });

        return new Response(JSON.stringify({
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // Main website with multi-language AGI metrics
    if (url.pathname === '/') {
      const metrics = multiLanguageAGI.getSystemMetrics();
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 Multi-Language AGI System - The Most Advanced AGI in the World!</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            padding: 40px 0;
        }
        .header h1 { 
            font-size: 3.5rem; 
            margin-bottom: 20px; 
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p { 
            font-size: 1.3rem; 
            opacity: 0.9; 
        }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 40px; 
        }
        .metric-card { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px); 
            border-radius: 15px; 
            padding: 25px; 
            border: 1px solid rgba(255,255,255,0.2);
        }
        .metric-card h3 { 
            margin-bottom: 15px; 
            color: #ffd700; 
            font-size: 1.4rem; 
        }
        .metric-value { 
            font-size: 2rem; 
            font-weight: bold; 
            margin-bottom: 10px; 
        }
        .metric-label { 
            opacity: 0.8; 
            font-size: 0.9rem; 
        }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px; 
        }
        .status-operational { background: #00ff00; }
        .status-initializing { background: #ffff00; }
        .status-error { background: #ff0000; }
        .capabilities { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin-top: 20px; 
        }
        .capability { 
            display: flex; 
            align-items: center; 
            padding: 10px; 
            background: rgba(255,255,255,0.05); 
            border-radius: 8px; 
        }
        .capability-icon { 
            margin-right: 10px; 
            font-size: 1.2rem; 
        }
        .capability-available { color: #00ff00; }
        .capability-unavailable { color: #ff4444; }
        .demo-section { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px); 
            border-radius: 15px; 
            padding: 25px; 
            margin-top: 30px; 
        }
        .demo-section h3 { 
            margin-bottom: 20px; 
            color: #ffd700; 
        }
        .input-group { 
            margin-bottom: 20px; 
        }
        .input-group label { 
            display: block; 
            margin-bottom: 5px; 
            font-weight: bold; 
        }
        .input-group input, .input-group textarea { 
            width: 100%; 
            padding: 12px; 
            border: none; 
            border-radius: 8px; 
            background: rgba(255,255,255,0.2); 
            color: white; 
            font-size: 1rem; 
        }
        .input-group input::placeholder, .input-group textarea::placeholder { 
            color: rgba(255,255,255,0.6); 
        }
        .btn { 
            background: linear-gradient(45deg, #ff6b6b, #ee5a24); 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            font-size: 1rem; 
            cursor: pointer; 
            transition: transform 0.2s; 
        }
        .btn:hover { transform: translateY(-2px); }
        .response { 
            margin-top: 20px; 
            padding: 15px; 
            background: rgba(0,0,0,0.3); 
            border-radius: 8px; 
            white-space: pre-wrap; 
            font-family: monospace; 
            max-height: 600px; 
            overflow-y: auto; 
        }
        .loading { 
            display: none; 
            text-align: center; 
            padding: 20px; 
        }
        .spinner { 
            border: 3px solid rgba(255,255,255,0.3); 
            border-top: 3px solid white; 
            border-radius: 50%; 
            width: 30px; 
            height: 30px; 
            animation: spin 1s linear infinite; 
            margin: 0 auto 10px; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding: 20px; 
            opacity: 0.7; 
        }

        /* Enhanced Mobile Responsiveness */
        @media (max-width: 768px) {
            .header h1 { 
                font-size: 2.5rem; 
                line-height: 1.2;
                margin-bottom: 15px;
            }
            .header p { 
                font-size: 1.1rem; 
                line-height: 1.4;
            }
            .container { 
                padding: 15px 10px; 
                max-width: 100%;
            }
            .metrics-grid { 
                grid-template-columns: 1fr; 
                gap: 15px;
                margin-bottom: 30px;
            }
            .metric-card { 
                padding: 20px 15px; 
                margin-bottom: 10px;
            }
            .metric-card h3 { 
                font-size: 1.2rem; 
                margin-bottom: 12px;
            }
            .metric-value { 
                font-size: 1.6rem; 
                margin-bottom: 8px;
            }
            .metric-label { 
                font-size: 0.8rem; 
            }
            .capabilities { 
                grid-template-columns: 1fr; 
                gap: 10px;
            }
            .capability { 
                padding: 12px; 
                font-size: 0.9rem;
            }
            .demo-section { 
                padding: 20px 15px; 
                margin-top: 20px;
            }
            .demo-section h3 { 
                font-size: 1.2rem; 
                margin-bottom: 15px;
            }
            .input-group input, 
            .input-group textarea { 
                padding: 15px; 
                font-size: 16px; /* Prevents zoom on iOS */
                border-radius: 8px;
            }
            .btn { 
                width: 100%; 
                margin-bottom: 10px;
                padding: 15px 20px; 
                font-size: 16px;
                border-radius: 8px;
                touch-action: manipulation;
            }
            .btn:active { 
                transform: scale(0.98); 
            }
            .response { 
                padding: 12px; 
                margin-top: 15px;
                max-height: 500px;
                font-size: 0.8rem;
                border-radius: 8px;
            }
        }

        /* Small Mobile Devices */
        @media (max-width: 480px) {
            .header h1 { 
                font-size: 2rem; 
            }
            .header p { 
                font-size: 1rem; 
            }
            .container { 
                padding: 10px 8px; 
            }
            .metric-card { 
                padding: 15px 12px; 
            }
            .metric-value { 
                font-size: 1.4rem; 
            }
            .demo-section { 
                padding: 15px 12px; 
            }
            .input-group input, 
            .input-group textarea { 
                padding: 12px; 
                font-size: 16px;
            }
            .btn { 
                padding: 12px 16px; 
                font-size: 15px;
            }
        }

        /* Touch Device Optimizations */
        @media (hover: none) and (pointer: coarse) {
            .btn { 
                min-height: 44px; /* iOS recommended touch target size */
            }
            .input-group input, 
            .input-group textarea { 
                min-height: 44px;
            }
            .metric-card { 
                cursor: pointer;
            }
            .metric-card:active { 
                transform: scale(0.98);
            }
        }

        /* Landscape Mobile */
        @media (max-width: 768px) and (orientation: landscape) {
            .header { 
                margin-bottom: 20px; 
                padding: 20px 0;
            }
            .header h1 { 
                font-size: 2rem; 
            }
            .metrics-grid { 
                grid-template-columns: repeat(2, 1fr); 
                gap: 10px;
            }
            .container { 
                padding: 10px 15px; 
            }
        }

        /* Mobile Navigation Improvements */
        @media (max-width: 768px) {
            html { 
                scroll-behavior: smooth; 
            }
            .btn:focus,
            .input-group input:focus,
            .input-group textarea:focus { 
                outline: 2px solid #ffd700; 
                outline-offset: 2px; 
            }
            body { 
                overflow-x: hidden; 
                width: 100%; 
            }
            ::selection { 
                background: #ffd700; 
                color: #333; 
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Multi-Language AGI System</h1>
            <p>The Most Advanced Artificial General Intelligence System in the World</p>
            <p>Combining Rust, C, TypeScript, WebAssembly, and Assembly for Revolutionary Performance</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>🚀 System Status</h3>
                <div class="metric-value">
                    <span class="status-indicator status-${metrics.system.status}"></span>
                    ${metrics.system.status.toUpperCase()}
                </div>
                <div class="metric-label">Multi-Language AGI System v${metrics.system.version}</div>
            </div>

            <div class="metric-card">
                <h3>⚡ Performance</h3>
                <div class="metric-value">${metrics.performance.operationsPerSecond.toFixed(2)}</div>
                <div class="metric-label">Operations per Second</div>
            </div>

            <div class="metric-card">
                <h3>🧠 Intelligence</h3>
                <div class="metric-value">${metrics.intelligence.multiLanguageProcessing ? 'ACTIVE' : 'INACTIVE'}</div>
                <div class="metric-label">Multi-Language Processing</div>
            </div>

            <div class="metric-card">
                <h3>⚙️ Language Engines</h3>
                <div class="metric-value">${metrics.performance.languageEngines}</div>
                <div class="metric-label">Active Language Engines</div>
            </div>

            <div class="metric-card">
                <h3>📊 Total Operations</h3>
                <div class="metric-value">${metrics.performance.totalOperations}</div>
                <div class="metric-label">Cumulative Operations</div>
            </div>

            <div class="metric-card">
                <h3>⏱️ Response Time</h3>
                <div class="metric-value">${metrics.metrics.averageResponseTime}</div>
                <div class="metric-label">Average Response Time</div>
            </div>
        </div>

        <div class="metric-card">
            <h3>🔧 Language Capabilities</h3>
            <div class="capabilities">
                <div class="capability">
                    <span class="capability-icon ${metrics.capabilities.rust ? 'capability-available' : 'capability-unavailable'}">
                        ${metrics.capabilities.rust ? '✅' : '❌'}
                    </span>
                    <span>Rust Core (Neural Foundation)</span>
                </div>
                <div class="capability">
                    <span class="capability-icon ${metrics.capabilities.c ? 'capability-available' : 'capability-unavailable'}">
                        ${metrics.capabilities.c ? '✅' : '❌'}
                    </span>
                    <span>C Core (SIMD Optimization)</span>
                </div>
                <div class="capability">
                    <span class="capability-icon ${metrics.capabilities.wasm ? 'capability-available' : 'capability-unavailable'}">
                        ${metrics.capabilities.wasm ? '✅' : '❌'}
                    </span>
                    <span>WebAssembly (Cross-Platform)</span>
                </div>
                <div class="capability">
                    <span class="capability-icon ${metrics.capabilities.assembly ? 'capability-available' : 'capability-unavailable'}">
                        ${metrics.capabilities.assembly ? '✅' : '❌'}
                    </span>
                    <span>Assembly (Critical Path)</span>
                </div>
            </div>
        </div>

        <div class="demo-section">
            <h3>🧪 Test the Multi-Language AGI System</h3>
            <div class="input-group">
                <label for="input-text">Input Text:</label>
                <textarea id="input-text" rows="4" placeholder="Enter text to process with the most advanced AGI system in the world...">Hello! I am testing the revolutionary multi-language AGI system that combines Rust, C, TypeScript, WebAssembly, and Assembly for unprecedented performance and intelligence.</textarea>
            </div>
            
            <div class="input-group">
                <label>
                    <input type="checkbox" id="use-rust" checked> Use Rust Core (Neural Foundation)
                </label>
                <label>
                    <input type="checkbox" id="use-c" checked> Use C Core (SIMD Optimization)
                </label>
                <label>
                    <input type="checkbox" id="use-wasm"> Use WebAssembly (Cross-Platform)
                </label>
                <label>
                    <input type="checkbox" id="use-assembly"> Use Assembly (Critical Path)
                </label>
            </div>

            <button class="btn" onclick="processInput()">🚀 Process with Multi-Language AGI</button>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Processing with the most advanced AGI system in the world...</p>
            </div>
            
            <div class="response" id="response" style="display: none;"></div>
        </div>

        <div class="footer">
            <p>🌟 Built with ❤️ by the AGI Team - Pushing the Boundaries of Artificial Intelligence 🌟</p>
            <p>🚀 This is the future of AGI - Multi-language orchestration for revolutionary performance 🚀</p>
        </div>
    </div>

    <script>
        async function processInput() {
            const text = document.getElementById('input-text').value;
            const useRust = document.getElementById('use-rust').checked;
            const useC = document.getElementById('use-c').checked;
            const useWasm = document.getElementById('use-wasm').checked;
            const useAssembly = document.getElementById('use-assembly').checked;

            if (!text.trim()) {
                alert('Please enter some text to process!');
                return;
            }

            // Show loading
            document.getElementById('loading').style.display = 'block';
            document.getElementById('response').style.display = 'none';

            try {
                const response = await fetch('/api/v1/multi-language-agi/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: text,
                        useRust: useRust,
                        useC: useC,
                        useWasm: useWasm,
                        useAssembly: useAssembly,
                        parallel: true,
                        timeout: 30000
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('response').innerHTML = JSON.stringify(result.data, null, 2);
                    document.getElementById('response').style.display = 'block';
                } else {
                    document.getElementById('response').innerHTML = 'Error: ' + result.error;
                    document.getElementById('response').style.display = 'block';
                }
            } catch (error) {
                document.getElementById('response').innerHTML = 'Error: ' + error.message;
                document.getElementById('response').style.display = 'block';
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        }

        // Auto-refresh metrics every 5 seconds
        setInterval(async () => {
            try {
                const response = await fetch('/api/v1/multi-language-agi/status');
                const result = await response.json();
                if (result.success) {
                    // Update metrics display (simplified for demo)
                    console.log('Metrics updated:', result.data);
                }
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }, 5000);
    </script>
</body>
</html>`;

      return new Response(html, {
        headers: { 
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Default response
    return new Response('Multi-Language AGI System API', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
