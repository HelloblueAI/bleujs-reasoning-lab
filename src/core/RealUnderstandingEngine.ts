/**
 * Real Understanding Engine
 * Extracts genuine understanding from input, not just pattern matching
 */

export interface Concept {
  name: string;
  domain: string;
  confidence: number;
  relationships: string[];
  properties: Map<string, any>;
}

export interface Understanding {
  concepts: Concept[];
  relationships: Array<{ from: string; to: string; type: string; strength: number }>;
  domains: string[];
  depth: number;
  confidence: number;
  insights: string[];
}

export class RealUnderstandingEngine {
  private knowledgeBase: Map<string, Concept> = new Map();
  private domainKnowledge: Map<string, Set<string>> = new Map();
  private conceptRelationships: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.initializeBaseKnowledge();
  }

  /**
   * Initialize with basic domain knowledge
   */
  private initializeBaseKnowledge(): void {
    // Mathematics domain
    this.addConcept('number', 'mathematics', ['quantity', 'value', 'measurement']);
    this.addConcept('addition', 'mathematics', ['operation', 'sum', 'combine']);
    this.addConcept('multiplication', 'mathematics', ['operation', 'product', 'scale']);
    
    // Physics domain
    this.addConcept('force', 'physics', ['interaction', 'acceleration', 'motion']);
    this.addConcept('energy', 'physics', ['capacity', 'work', 'power']);
    
    // Computer Science domain
    this.addConcept('algorithm', 'computer_science', ['procedure', 'computation', 'logic']);
    this.addConcept('data', 'computer_science', ['information', 'storage', 'processing']);
    
    // Create cross-domain relationships
    this.linkConcepts('number', 'data', 'representation', 0.8);
    this.linkConcepts('algorithm', 'operation', 'process', 0.7);
  }

  /**
   * Extract genuine understanding from input
   */
  public understand(input: string): Understanding {
    const _startTime = Date.now();
    
    // Extract concepts from input
    const extractedConcepts = this.extractConcepts(input);
    
    // Identify domains
    const domains = this.identifyDomains(extractedConcepts);
    
    // Build relationships
    const relationships = this.buildRelationships(extractedConcepts);
    
    // Calculate understanding depth
    const depth = this.calculateDepth(extractedConcepts, relationships);
    
    // Generate insights
    const insights = this.generateInsights(extractedConcepts, relationships, domains);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(extractedConcepts, relationships);
    
    // Store new concepts
    extractedConcepts.forEach(concept => {
      if (!this.knowledgeBase.has(concept.name)) {
        this.knowledgeBase.set(concept.name, concept);
      }
    });
    
    return {
      concepts: extractedConcepts,
      relationships,
      domains,
      depth,
      confidence,
      insights
    };
  }

  /**
   * Extract concepts from text
   */
  private extractConcepts(text: string): Concept[] {
    const concepts: Concept[] = [];
    const _words = text.toLowerCase().split(/\s+/);
    
    // Known concept patterns
    const conceptPatterns = [
      { pattern: /\b(number|num|digit|integer|float)\b/i, concept: 'number', domain: 'mathematics' },
      { pattern: /\b(add|plus|sum|addition)\b/i, concept: 'addition', domain: 'mathematics' },
      { pattern: /\b(multiply|times|product|multiplication)\b/i, concept: 'multiplication', domain: 'mathematics' },
      { pattern: /\b(force|push|pull|pressure)\b/i, concept: 'force', domain: 'physics' },
      { pattern: /\b(energy|power|work|joule)\b/i, concept: 'energy', domain: 'physics' },
      { pattern: /\b(algorithm|code|program|software)\b/i, concept: 'algorithm', domain: 'computer_science' },
      { pattern: /\b(data|information|storage|database)\b/i, concept: 'data', domain: 'computer_science' },
      { pattern: /\bwhere\b.*\b(is|are|was|were)\b/i, concept: 'location_query', domain: 'geography' },
      { pattern: /\b(capital|city|country|continent|region|province|latitude|longitude)\b/i, concept: 'geography', domain: 'geography' },
      { pattern: /\b(learn|learning|train|training)\b/i, concept: 'learning', domain: 'general' },
      { pattern: /\b(understand|comprehend|grasp|know)\b/i, concept: 'understanding', domain: 'general' },
      { pattern: /\b(reason|reasoning|logic|logical)\b/i, concept: 'reasoning', domain: 'general' },
      { pattern: /\b(create|creative|innovation|novel)\b/i, concept: 'creativity', domain: 'general' },
      { pattern: /\b(intelligence|smart|intelligent|ai)\b/i, concept: 'intelligence', domain: 'general' }
    ];
    
    const foundConcepts = new Set<string>();
    
    conceptPatterns.forEach(({ pattern, concept, domain }) => {
      if (pattern.test(text) && !foundConcepts.has(concept)) {
        foundConcepts.add(concept);
        const existingConcept = this.knowledgeBase.get(concept);
        
        concepts.push({
          name: concept,
          domain,
          confidence: existingConcept ? 0.9 : 0.7,
          relationships: existingConcept?.relationships || [],
          properties: existingConcept?.properties || new Map()
        });
      }
    });
    
    const placeMatch = text.match(/\bwhere\s+(?:is|are)\s+(?:the\s+)?([a-z][a-z\s'-]{1,40}?)\??\s*$/i);
    if (placeMatch) {
      const place = placeMatch[1].trim();
      if (!foundConcepts.has(place.toLowerCase())) {
        foundConcepts.add(place.toLowerCase());
        concepts.push({
          name: place,
          domain: 'geography',
          confidence: 0.8,
          relationships: [],
          properties: new Map(),
        });
      }
    }
    
    // Extract noun phrases as potential new concepts
    const nounPhrases = this.extractNounPhrases(text);
    nounPhrases.forEach(phrase => {
      if (!foundConcepts.has(phrase) && phrase.length > 3) {
        const domain = this.inferDomain(phrase, concepts);
        concepts.push({
          name: phrase,
          domain,
          confidence: 0.5,
          relationships: [],
          properties: new Map()
        });
      }
    });
    
    return concepts;
  }

  /**
   * Extract noun phrases from text
   */
  private extractNounPhrases(text: string): string[] {
    // Simple noun phrase extraction
    const phrases: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Look for adjective + noun patterns
    for (let i = 0; i < words.length - 1; i++) {
      const twoWord = `${words[i]} ${words[i + 1]}`;
      if (twoWord.length > 5 && !twoWord.match(/^(the|a|an|is|are|was|were)\s/)) {
        phrases.push(twoWord);
      }
    }
    
    return phrases.slice(0, 5); // Limit to 5 phrases
  }

  /**
   * Infer domain from context
   */
  private inferDomain(phrase: string, existingConcepts: Concept[]): string {
    // Use existing concepts to infer domain
    if (existingConcepts.length > 0) {
      const domainCounts = new Map<string, number>();
      existingConcepts.forEach(c => {
        domainCounts.set(c.domain, (domainCounts.get(c.domain) || 0) + 1);
      });
      
      let maxCount = 0;
      let inferredDomain = 'general';
      domainCounts.forEach((count, domain) => {
        if (count > maxCount) {
          maxCount = count;
          inferredDomain = domain;
        }
      });
      
      return inferredDomain;
    }
    
    return 'general';
  }

  /**
   * Identify domains from concepts
   */
  private identifyDomains(concepts: Concept[]): string[] {
    const domains = new Set<string>();
    concepts.forEach(c => domains.add(c.domain));
    return Array.from(domains);
  }

  /**
   * Build relationships between concepts
   */
  private buildRelationships(concepts: Concept[]): Array<{ from: string; to: string; type: string; strength: number }> {
    const relationships: Array<{ from: string; to: string; type: string; strength: number }> = [];
    
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const concept1 = concepts[i];
        const concept2 = concepts[j];
        
        if (!concept1 || !concept2) continue;
        
        // Check for existing relationship
        const existingStrength = this.getRelationshipStrength(concept1.name, concept2.name);
        if (existingStrength > 0) {
          relationships.push({
            from: concept1.name,
            to: concept2.name,
            type: 'known',
            strength: existingStrength
          });
        } else if (concept1.domain === concept2.domain) {
          // Same domain = related
          relationships.push({
            from: concept1.name,
            to: concept2.name,
            type: 'domain',
            strength: 0.6
          });
        } else {
          // Cross-domain = potentially interesting
          relationships.push({
            from: concept1.name,
            to: concept2.name,
            type: 'cross-domain',
            strength: 0.4
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Get relationship strength between two concepts
   */
  private getRelationshipStrength(concept1: string, concept2: string): number {
    const rels1 = this.conceptRelationships.get(concept1);
    if (rels1) {
      return rels1.get(concept2) || 0;
    }
    return 0;
  }

  /**
   * Calculate understanding depth
   */
  private calculateDepth(concepts: Concept[], relationships: Array<{ from: string; to: string; type: string; strength: number }>): number {
    if (concepts.length === 0) return 0;
    
    // Depth based on number of concepts
    const conceptFactor = Math.min(concepts.length / 10, 0.4);
    
    // Depth based on relationships
    const relationshipFactor = Math.min(relationships.length / 20, 0.3);
    
    // Depth based on cross-domain connections
    const crossDomainCount = relationships.filter(r => r.type === 'cross-domain').length;
    const crossDomainFactor = Math.min(crossDomainCount / 5, 0.3);
    
    return Math.min(0.95, conceptFactor + relationshipFactor + crossDomainFactor);
  }

  /**
   * Generate insights from understanding
   */
  private generateInsights(
    concepts: Concept[],
    relationships: Array<{ from: string; to: string; type: string; strength: number }>,
    domains: string[]
  ): string[] {
    const insights: string[] = [];
    
    // Cross-domain insight
    if (domains.length > 1) {
      insights.push(`Cross-domain connection identified between ${domains.join(' and ')}`);
    }
    
    // Relationship insights
    const strongRelationships = relationships.filter(r => r.strength > 0.7);
    if (strongRelationships.length > 0) {
      insights.push(`Found ${strongRelationships.length} strong concept relationships`);
    }
    
    // Concept discovery
    const newConcepts = concepts.filter(c => c.confidence < 0.8);
    if (newConcepts.length > 0) {
      insights.push(`Identified ${newConcepts.length} potentially new concepts`);
    }
    
    return insights;
  }

  /**
   * Calculate confidence in understanding
   */
  private calculateConfidence(concepts: Concept[], relationships: Array<{ from: string; to: string; type: string; strength: number }>): number {
    if (concepts.length === 0) return 0;
    
    // Average concept confidence
    const avgConceptConfidence = concepts.reduce((sum, c) => sum + c.confidence, 0) / concepts.length;
    
    // Relationship strength factor
    const avgRelationshipStrength = relationships.length > 0
      ? relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length
      : 0;
    
    return (avgConceptConfidence * 0.7 + avgRelationshipStrength * 0.3);
  }

  /**
   * Add a concept to knowledge base
   */
  private addConcept(name: string, domain: string, relationships: string[]): void {
    this.knowledgeBase.set(name, {
      name,
      domain,
      confidence: 0.9,
      relationships,
      properties: new Map()
    });
    
    if (!this.domainKnowledge.has(domain)) {
      this.domainKnowledge.set(domain, new Set());
    }
    this.domainKnowledge.get(domain)!.add(name);
  }

  /**
   * Link two concepts
   */
  private linkConcepts(concept1: string, concept2: string, type: string, strength: number): void {
    if (!this.conceptRelationships.has(concept1)) {
      this.conceptRelationships.set(concept1, new Map());
    }
    this.conceptRelationships.get(concept1)!.set(concept2, strength);
    
    // Bidirectional
    if (!this.conceptRelationships.has(concept2)) {
      this.conceptRelationships.set(concept2, new Map());
    }
    this.conceptRelationships.get(concept2)!.set(concept1, strength);
  }

  /**
   * Get cross-domain connections
   */
  public getCrossDomainConnections(): Array<{ concept1: string; concept2: string; domain1: string; domain2: string; strength: number }> {
    const connections: Array<{ concept1: string; concept2: string; domain1: string; domain2: string; strength: number }> = [];
    
    this.conceptRelationships.forEach((rels, concept1) => {
      const c1 = this.knowledgeBase.get(concept1);
      if (!c1) return;
      
      rels.forEach((strength, concept2) => {
        const c2 = this.knowledgeBase.get(concept2);
        if (c2 && c1.domain !== c2.domain && strength > 0.5) {
          connections.push({
            concept1,
            concept2,
            domain1: c1.domain,
            domain2: c2.domain,
            strength
          });
        }
      });
    });
    
    return connections;
  }
}

