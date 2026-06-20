export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    if (path === '/status') {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Hybrid Reasoning System Worker is working!",
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });
    }
    
    if (path === '/') {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Hybrid Reasoning System Worker is running!",
        endpoints: ['/status', '/reason', '/learn', '/create']
      }), { headers: corsHeaders });
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Endpoint not found',
      availableEndpoints: ['/status', '/']
    }), { 
      status: 404,
      headers: corsHeaders 
    });
  }
}; 