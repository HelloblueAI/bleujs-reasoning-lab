import { Logger } from '@/utils/Logger';
import { isSafeObjectKey } from '@/utils/security';

export interface SystemConfig {
  // Core system settings
  system: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    debug: boolean;
    logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    maxConcurrency: number;
    timeout: number;
  };
  
  // AGI specific settings
  agi: {
    reasoningEnabled: boolean;
    learningEnabled: boolean;
    creativityEnabled: boolean;
    consciousnessEnabled: boolean;
    multiAgentEnabled: boolean;
    maxAgents: number;
    agentTimeout: number;
    reasoningTimeout: number;
    learningTimeout: number;
  };
  
  // Memory settings
  memory: {
    shortTermCapacity: number;
    longTermCapacity: number;
    workingMemoryCapacity: number;
    consolidationThreshold: number;
    decayRate: number;
    optimizationInterval: number;
  };
  
  // Performance settings
  performance: {
    maxResponseTime: number;
    maxThroughput: number;
    resourceLimit: number;
    cacheEnabled: boolean;
    cacheSize: number;
    cacheTTL: number;
  };
  
  // Security settings
  security: {
    authenticationEnabled: boolean;
    authorizationEnabled: boolean;
    encryptionEnabled: boolean;
    rateLimitEnabled: boolean;
    maxRequestsPerMinute: number;
    allowedOrigins: string[];
    apiKeyRequired: boolean;
  };
  
  // External services
  services: {
    openai: {
      enabled: boolean;
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
    };
    anthropic: {
      enabled: boolean;
      apiKey: string;
      model: string;
      maxTokens: number;
    };
    database: {
      enabled: boolean;
      type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
      url: string;
      username: string;
      password: string;
      poolSize: number;
    };
    redis: {
      enabled: boolean;
      url: string;
      password: string;
      db: number;
    };
  };
  
  // Feature flags
  features: {
    advancedReasoning: boolean;
    metaLearning: boolean;
    creativeProblemSolving: boolean;
    consciousnessSimulation: boolean;
    multiModalProcessing: boolean;
    realTimeLearning: boolean;
    adaptiveBehavior: boolean;
    selfImprovement: boolean;
  };
  
  // Monitoring and logging
  monitoring: {
    enabled: boolean;
    metricsEnabled: boolean;
    healthCheckEnabled: boolean;
    alertingEnabled: boolean;
    logRetention: number;
    performanceTracking: boolean;
  };
}

export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigUpdate {
  path: string[];
  oldValue: any;
  newValue: any;
  timestamp: number;
  source: string;
}

export class ConfigurationManager {
  private config: SystemConfig;
  private configHistory: ConfigUpdate[] = [];
  private validationRules: Map<string, (value: any) => boolean> = new Map();
  private watchers: Map<string, ((config: SystemConfig) => void)[]> = new Map();
  
  private logger: Logger;
  // private readonly _CONFIG_FILE = 'config.json'; // Unused for now
  // private readonly _ENV_PREFIX = 'AGI_'; // Unused for now

  constructor() {
    this.logger = new Logger('ConfigurationManager');
    this.config = this.createDefaultConfig();
    this.initializeValidationRules();
    this.loadConfiguration();
  }

  private createDefaultConfig(): SystemConfig {
    return {
      system: {
        name: 'AGI Superintelligence System',
        version: '1.0.0',
        environment: 'development',
        debug: true,
        logLevel: 'info',
        maxConcurrency: 10,
        timeout: 30000
      },
      agi: {
        reasoningEnabled: true,
        learningEnabled: true,
        creativityEnabled: true,
        consciousnessEnabled: true,
        multiAgentEnabled: true,
        maxAgents: 5,
        agentTimeout: 60000,
        reasoningTimeout: 30000,
        learningTimeout: 45000
      },
      memory: {
        shortTermCapacity: 1000,
        longTermCapacity: 10000,
        workingMemoryCapacity: 100,
        consolidationThreshold: 0.7,
        decayRate: 0.1,
        optimizationInterval: 300000 // 5 minutes
      },
      performance: {
        maxResponseTime: 5000,
        maxThroughput: 1000,
        resourceLimit: 0.8,
        cacheEnabled: true,
        cacheSize: 1000,
        cacheTTL: 3600000 // 1 hour
      },
      security: {
        authenticationEnabled: true,
        authorizationEnabled: true,
        encryptionEnabled: true,
        rateLimitEnabled: true,
        maxRequestsPerMinute: 100,
        allowedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
        apiKeyRequired: false
      },
      services: {
        openai: {
          enabled: false,
          apiKey: process.env['OPENAI_API_KEY'] || '',
          model: 'gpt-4',
          maxTokens: 4096,
          temperature: 0.7
        },
        anthropic: {
          enabled: false,
          apiKey: process.env['ANTHROPIC_API_KEY'] || '',
          model: 'claude-3-sonnet',
          maxTokens: 4096
        },
        database: {
          enabled: false,
          type: 'postgres',
          url: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/agi',
          username: process.env['DB_USERNAME'] || '',
          password: process.env['DB_PASSWORD'] || '',
          poolSize: 10
        },
        redis: {
          enabled: false,
          url: process.env['REDIS_URL'] || 'redis://localhost:6379',
          password: process.env['REDIS_PASSWORD'] || '',
          db: 0
        }
      },
      features: {
        advancedReasoning: true,
        metaLearning: true,
        creativeProblemSolving: true,
        consciousnessSimulation: true,
        multiModalProcessing: true,
        realTimeLearning: true,
        adaptiveBehavior: true,
        selfImprovement: true
      },
      monitoring: {
        enabled: true,
        metricsEnabled: true,
        healthCheckEnabled: true,
        alertingEnabled: true,
        logRetention: 30, // days
        performanceTracking: true
      }
    };
  }

  private initializeValidationRules(): void {
    // System validation rules
    this.validationRules.set('system.name', (value) => typeof value === 'string' && value.length > 0);
    this.validationRules.set('system.version', (value) => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value));
    this.validationRules.set('system.environment', (value) => ['development', 'staging', 'production'].includes(value));
    this.validationRules.set('system.debug', (value) => typeof value === 'boolean');
    this.validationRules.set('system.logLevel', (value) => ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(value));
    this.validationRules.set('system.maxConcurrency', (value) => typeof value === 'number' && value > 0 && value <= 100);
    this.validationRules.set('system.timeout', (value) => typeof value === 'number' && value > 0);

    // AGI validation rules
    this.validationRules.set('agi.reasoningEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('agi.learningEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('agi.creativityEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('agi.consciousnessEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('agi.multiAgentEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('agi.maxAgents', (value) => typeof value === 'number' && value > 0 && value <= 50);
    this.validationRules.set('agi.agentTimeout', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('agi.reasoningTimeout', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('agi.learningTimeout', (value) => typeof value === 'number' && value > 0);

    // Memory validation rules
    this.validationRules.set('memory.shortTermCapacity', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('memory.longTermCapacity', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('memory.workingMemoryCapacity', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('memory.consolidationThreshold', (value) => typeof value === 'number' && value >= 0 && value <= 1);
    this.validationRules.set('memory.decayRate', (value) => typeof value === 'number' && value >= 0 && value <= 1);
    this.validationRules.set('memory.optimizationInterval', (value) => typeof value === 'number' && value > 0);

    // Performance validation rules
    this.validationRules.set('performance.maxResponseTime', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('performance.maxThroughput', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('performance.resourceLimit', (value) => typeof value === 'number' && value > 0 && value <= 1);
    this.validationRules.set('performance.cacheEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('performance.cacheSize', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('performance.cacheTTL', (value) => typeof value === 'number' && value > 0);

    // Security validation rules
    this.validationRules.set('security.authenticationEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('security.authorizationEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('security.encryptionEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('security.rateLimitEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('security.maxRequestsPerMinute', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('security.allowedOrigins', (value) => Array.isArray(value) && value.every(origin => typeof origin === 'string'));
    this.validationRules.set('security.apiKeyRequired', (value) => typeof value === 'boolean');

    // Services validation rules
    this.validationRules.set('services.openai.enabled', (value) => typeof value === 'boolean');
    this.validationRules.set('services.openai.apiKey', (value) => typeof value === 'string');
    this.validationRules.set('services.openai.model', (value) => typeof value === 'string' && value.length > 0);
    this.validationRules.set('services.openai.maxTokens', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('services.openai.temperature', (value) => typeof value === 'number' && value >= 0 && value <= 2);

    this.validationRules.set('services.anthropic.enabled', (value) => typeof value === 'boolean');
    this.validationRules.set('services.anthropic.apiKey', (value) => typeof value === 'string');
    this.validationRules.set('services.anthropic.model', (value) => typeof value === 'string' && value.length > 0);
    this.validationRules.set('services.anthropic.maxTokens', (value) => typeof value === 'number' && value > 0);

    this.validationRules.set('services.database.enabled', (value) => typeof value === 'boolean');
    this.validationRules.set('services.database.type', (value) => ['postgres', 'mysql', 'sqlite', 'mongodb'].includes(value));
    this.validationRules.set('services.database.url', (value) => typeof value === 'string' && value.length > 0);
    this.validationRules.set('services.database.username', (value) => typeof value === 'string');
    this.validationRules.set('services.database.password', (value) => typeof value === 'string');
    this.validationRules.set('services.database.poolSize', (value) => typeof value === 'number' && value > 0);

    this.validationRules.set('services.redis.enabled', (value) => typeof value === 'boolean');
    this.validationRules.set('services.redis.url', (value) => typeof value === 'string' && value.length > 0);
    this.validationRules.set('services.redis.password', (value) => typeof value === 'string');
    this.validationRules.set('services.redis.db', (value) => typeof value === 'number' && value >= 0);

    // Features validation rules
    this.validationRules.set('features.advancedReasoning', (value) => typeof value === 'boolean');
    this.validationRules.set('features.metaLearning', (value) => typeof value === 'boolean');
    this.validationRules.set('features.creativeProblemSolving', (value) => typeof value === 'boolean');
    this.validationRules.set('features.consciousnessSimulation', (value) => typeof value === 'boolean');
    this.validationRules.set('features.multiModalProcessing', (value) => typeof value === 'boolean');
    this.validationRules.set('features.realTimeLearning', (value) => typeof value === 'boolean');
    this.validationRules.set('features.adaptiveBehavior', (value) => typeof value === 'boolean');
    this.validationRules.set('features.selfImprovement', (value) => typeof value === 'boolean');

    // Monitoring validation rules
    this.validationRules.set('monitoring.enabled', (value) => typeof value === 'boolean');
    this.validationRules.set('monitoring.metricsEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('monitoring.healthCheckEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('monitoring.alertingEnabled', (value) => typeof value === 'boolean');
    this.validationRules.set('monitoring.logRetention', (value) => typeof value === 'number' && value > 0);
    this.validationRules.set('monitoring.performanceTracking', (value) => typeof value === 'boolean');
  }

  private loadConfiguration(): void {
    try {
      // Load from environment variables
      this.loadFromEnvironment();
      
      // Load from config file if exists
      this.loadFromFile();
      
      // Validate configuration
      const validation = this.validateConfiguration();
      if (!validation.isValid) {
        this.logger.warn('Configuration validation failed', { errors: validation.errors });
      }
      
      this.logger.info('Configuration loaded successfully');
      
    } catch (error) {
      this.logger.error('Failed to load configuration', error as Error);
    }
  }

  private loadFromEnvironment(): void {
    const env = process.env;
    
    // System settings
    if (env['AGI_SYSTEM_NAME']) this.config.system.name = env['AGI_SYSTEM_NAME'];
    if (env['AGI_SYSTEM_VERSION']) this.config.system.version = env['AGI_SYSTEM_VERSION'];
    if (env['AGI_SYSTEM_ENVIRONMENT']) this.config.system.environment = env['AGI_SYSTEM_ENVIRONMENT'] as any;
    if (env['AGI_SYSTEM_DEBUG']) this.config.system.debug = env['AGI_SYSTEM_DEBUG'] === 'true';
    if (env['AGI_SYSTEM_LOG_LEVEL']) this.config.system.logLevel = env['AGI_SYSTEM_LOG_LEVEL'] as any;
    if (env['AGI_SYSTEM_MAX_CONCURRENCY']) this.config.system.maxConcurrency = parseInt(env['AGI_SYSTEM_MAX_CONCURRENCY']);
    if (env['AGI_SYSTEM_TIMEOUT']) this.config.system.timeout = parseInt(env['AGI_SYSTEM_TIMEOUT']);

    // AGI settings
    if (env['AGI_REASONING_ENABLED']) this.config.agi.reasoningEnabled = env['AGI_REASONING_ENABLED'] === 'true';
    if (env['AGI_LEARNING_ENABLED']) this.config.agi.learningEnabled = env['AGI_LEARNING_ENABLED'] === 'true';
    if (env['AGI_CREATIVITY_ENABLED']) this.config.agi.creativityEnabled = env['AGI_CREATIVITY_ENABLED'] === 'true';
    if (env['AGI_CONSCIOUSNESS_ENABLED']) this.config.agi.consciousnessEnabled = env['AGI_CONSCIOUSNESS_ENABLED'] === 'true';
    if (env['AGI_MULTI_AGENT_ENABLED']) this.config.agi.multiAgentEnabled = env['AGI_MULTI_AGENT_ENABLED'] === 'true';
    if (env['AGI_MAX_AGENTS']) this.config.agi.maxAgents = parseInt(env['AGI_MAX_AGENTS']);
    if (env['AGI_AGENT_TIMEOUT']) this.config.agi.agentTimeout = parseInt(env['AGI_AGENT_TIMEOUT']);
    if (env['AGI_REASONING_TIMEOUT']) this.config.agi.reasoningTimeout = parseInt(env['AGI_REASONING_TIMEOUT']);
    if (env['AGI_LEARNING_TIMEOUT']) this.config.agi.learningTimeout = parseInt(env['AGI_LEARNING_TIMEOUT']);

    // Memory settings
    if (env['AGI_MEMORY_SHORT_TERM_CAPACITY']) this.config.memory.shortTermCapacity = parseInt(env['AGI_MEMORY_SHORT_TERM_CAPACITY']);
    if (env['AGI_MEMORY_LONG_TERM_CAPACITY']) this.config.memory.longTermCapacity = parseInt(env['AGI_MEMORY_LONG_TERM_CAPACITY']);
    if (env['AGI_MEMORY_WORKING_CAPACITY']) this.config.memory.workingMemoryCapacity = parseInt(env['AGI_MEMORY_WORKING_CAPACITY']);
    if (env['AGI_MEMORY_CONSOLIDATION_THRESHOLD']) this.config.memory.consolidationThreshold = parseFloat(env['AGI_MEMORY_CONSOLIDATION_THRESHOLD']);
    if (env['AGI_MEMORY_DECAY_RATE']) this.config.memory.decayRate = parseFloat(env['AGI_MEMORY_DECAY_RATE']);
    if (env['AGI_MEMORY_OPTIMIZATION_INTERVAL']) this.config.memory.optimizationInterval = parseInt(env['AGI_MEMORY_OPTIMIZATION_INTERVAL']);

    // Performance settings
    if (env['AGI_PERFORMANCE_MAX_RESPONSE_TIME']) this.config.performance.maxResponseTime = parseInt(env['AGI_PERFORMANCE_MAX_RESPONSE_TIME']);
    if (env['AGI_PERFORMANCE_MAX_THROUGHPUT']) this.config.performance.maxThroughput = parseInt(env['AGI_PERFORMANCE_MAX_THROUGHPUT']);
    if (env['AGI_PERFORMANCE_RESOURCE_LIMIT']) this.config.performance.resourceLimit = parseFloat(env['AGI_PERFORMANCE_RESOURCE_LIMIT']);
    if (env['AGI_PERFORMANCE_CACHE_ENABLED']) this.config.performance.cacheEnabled = env['AGI_PERFORMANCE_CACHE_ENABLED'] === 'true';
    if (env['AGI_PERFORMANCE_CACHE_SIZE']) this.config.performance.cacheSize = parseInt(env['AGI_PERFORMANCE_CACHE_SIZE']);
    if (env['AGI_PERFORMANCE_CACHE_TTL']) this.config.performance.cacheTTL = parseInt(env['AGI_PERFORMANCE_CACHE_TTL']);

    // Security settings
    if (env['AGI_SECURITY_AUTHENTICATION_ENABLED']) this.config.security.authenticationEnabled = env['AGI_SECURITY_AUTHENTICATION_ENABLED'] === 'true';
    if (env['AGI_SECURITY_AUTHORIZATION_ENABLED']) this.config.security.authorizationEnabled = env['AGI_SECURITY_AUTHORIZATION_ENABLED'] === 'true';
    if (env['AGI_SECURITY_ENCRYPTION_ENABLED']) this.config.security.encryptionEnabled = env['AGI_SECURITY_ENCRYPTION_ENABLED'] === 'true';
    if (env['AGI_SECURITY_RATE_LIMIT_ENABLED']) this.config.security.rateLimitEnabled = env['AGI_SECURITY_RATE_LIMIT_ENABLED'] === 'true';
    if (env['AGI_SECURITY_MAX_REQUESTS_PER_MINUTE']) this.config.security.maxRequestsPerMinute = parseInt(env['AGI_SECURITY_MAX_REQUESTS_PER_MINUTE']);
    if (env['AGI_SECURITY_ALLOWED_ORIGINS']) this.config.security.allowedOrigins = env['AGI_SECURITY_ALLOWED_ORIGINS'].split(',');
    if (env['AGI_SECURITY_API_KEY_REQUIRED']) this.config.security.apiKeyRequired = env['AGI_SECURITY_API_KEY_REQUIRED'] === 'true';

    // Services settings
    if (env['AGI_SERVICES_OPENAI_ENABLED']) this.config.services.openai.enabled = env['AGI_SERVICES_OPENAI_ENABLED'] === 'true';
    if (env['AGI_SERVICES_OPENAI_API_KEY']) this.config.services.openai.apiKey = env['AGI_SERVICES_OPENAI_API_KEY'];
    if (env['AGI_SERVICES_OPENAI_MODEL']) this.config.services.openai.model = env['AGI_SERVICES_OPENAI_MODEL'];
    if (env['AGI_SERVICES_OPENAI_MAX_TOKENS']) this.config.services.openai.maxTokens = parseInt(env['AGI_SERVICES_OPENAI_MAX_TOKENS']);
    if (env['AGI_SERVICES_OPENAI_TEMPERATURE']) this.config.services.openai.temperature = parseFloat(env['AGI_SERVICES_OPENAI_TEMPERATURE']);

    if (env['AGI_SERVICES_ANTHROPIC_ENABLED']) this.config.services.anthropic.enabled = env['AGI_SERVICES_ANTHROPIC_ENABLED'] === 'true';
    if (env['AGI_SERVICES_ANTHROPIC_API_KEY']) this.config.services.anthropic.apiKey = env['AGI_SERVICES_ANTHROPIC_API_KEY'];
    if (env['AGI_SERVICES_ANTHROPIC_MODEL']) this.config.services.anthropic.model = env['AGI_SERVICES_ANTHROPIC_MODEL'];
    if (env['AGI_SERVICES_ANTHROPIC_MAX_TOKENS']) this.config.services.anthropic.maxTokens = parseInt(env['AGI_SERVICES_ANTHROPIC_MAX_TOKENS']);

    if (env['AGI_SERVICES_DATABASE_ENABLED']) this.config.services.database.enabled = env['AGI_SERVICES_DATABASE_ENABLED'] === 'true';
    if (env['AGI_SERVICES_DATABASE_TYPE']) this.config.services.database.type = env['AGI_SERVICES_DATABASE_TYPE'] as any;
    if (env['AGI_SERVICES_DATABASE_URL']) this.config.services.database.url = env['AGI_SERVICES_DATABASE_URL'];
    if (env['AGI_SERVICES_DATABASE_USERNAME']) this.config.services.database.username = env['AGI_SERVICES_DATABASE_USERNAME'];
    if (env['AGI_SERVICES_DATABASE_PASSWORD']) this.config.services.database.password = env['AGI_SERVICES_DATABASE_PASSWORD'];
    if (env['AGI_SERVICES_DATABASE_POOL_SIZE']) this.config.services.database.poolSize = parseInt(env['AGI_SERVICES_DATABASE_POOL_SIZE']);

    if (env['AGI_SERVICES_REDIS_ENABLED']) this.config.services.redis.enabled = env['AGI_SERVICES_REDIS_ENABLED'] === 'true';
    if (env['AGI_SERVICES_REDIS_URL']) this.config.services.redis.url = env['AGI_SERVICES_REDIS_URL'];
    if (env['AGI_SERVICES_REDIS_PASSWORD']) this.config.services.redis.password = env['AGI_SERVICES_REDIS_PASSWORD'];
    if (env['AGI_SERVICES_REDIS_DB']) this.config.services.redis.db = parseInt(env['AGI_SERVICES_REDIS_DB']);

    // Features settings
    if (env['AGI_FEATURES_ADVANCED_REASONING']) this.config.features.advancedReasoning = env['AGI_FEATURES_ADVANCED_REASONING'] === 'true';
    if (env['AGI_FEATURES_META_LEARNING']) this.config.features.metaLearning = env['AGI_FEATURES_META_LEARNING'] === 'true';
    if (env['AGI_FEATURES_CREATIVE_PROBLEM_SOLVING']) this.config.features.creativeProblemSolving = env['AGI_FEATURES_CREATIVE_PROBLEM_SOLVING'] === 'true';
    if (env['AGI_FEATURES_CONSCIOUSNESS_SIMULATION']) this.config.features.consciousnessSimulation = env['AGI_FEATURES_CONSCIOUSNESS_SIMULATION'] === 'true';
    if (env['AGI_FEATURES_MULTI_MODAL_PROCESSING']) this.config.features.multiModalProcessing = env['AGI_FEATURES_MULTI_MODAL_PROCESSING'] === 'true';
    if (env['AGI_FEATURES_REAL_TIME_LEARNING']) this.config.features.realTimeLearning = env['AGI_FEATURES_REAL_TIME_LEARNING'] === 'true';
    if (env['AGI_FEATURES_ADAPTIVE_BEHAVIOR']) this.config.features.adaptiveBehavior = env['AGI_FEATURES_ADAPTIVE_BEHAVIOR'] === 'true';
    if (env['AGI_FEATURES_SELF_IMPROVEMENT']) this.config.features.selfImprovement = env['AGI_FEATURES_SELF_IMPROVEMENT'] === 'true';

    // Monitoring settings
    if (env['AGI_MONITORING_ENABLED']) this.config.monitoring.enabled = env['AGI_MONITORING_ENABLED'] === 'true';
    if (env['AGI_MONITORING_METRICS_ENABLED']) this.config.monitoring.metricsEnabled = env['AGI_MONITORING_METRICS_ENABLED'] === 'true';
    if (env['AGI_MONITORING_HEALTH_CHECK_ENABLED']) this.config.monitoring.healthCheckEnabled = env['AGI_MONITORING_HEALTH_CHECK_ENABLED'] === 'true';
    if (env['AGI_MONITORING_ALERTING_ENABLED']) this.config.monitoring.alertingEnabled = env['AGI_MONITORING_ALERTING_ENABLED'] === 'true';
    if (env['AGI_MONITORING_LOG_RETENTION']) this.config.monitoring.logRetention = parseInt(env['AGI_MONITORING_LOG_RETENTION']);
    if (env['AGI_MONITORING_PERFORMANCE_TRACKING']) this.config.monitoring.performanceTracking = env['AGI_MONITORING_PERFORMANCE_TRACKING'] === 'true';
  }

  private loadFromFile(): void {
    try {
      // In a real implementation, this would load from a JSON file
      // For now, we'll just log that we would load from file
      this.logger.debug('Configuration file loading would be implemented here');
    } catch (error) {
      this.logger.warn('Failed to load configuration file', { error });
    }
  }

  public getConfiguration(): SystemConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep copy
  }

  public getValue(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      if (!isSafeObjectKey(key)) {
        return undefined;
      }
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  public setValue(path: string, value: any, source: string = 'manual'): boolean {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    if (!keys.every(isSafeObjectKey) || !isSafeObjectKey(lastKey)) {
      this.logger.error('Invalid configuration path', { path } as any);
      return false;
    }
    let current: any = this.config;
    
    // Navigate to the parent object
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        this.logger.error('Invalid configuration path', { path } as any);
        return false;
      }
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        // Inline literal guard — CodeQL traces this shape, not isSafeObjectKey()
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          current[key] = {};
        }
      }
      current = current[key];
    }
    
    // Validate the value
    const validationRule = this.validationRules.get(path);
    if (typeof validationRule === 'function' && !validationRule(value)) {
      this.logger.error('Invalid configuration value', { path, value } as any);
      return false;
    }
    
    const oldValue = current[lastKey];
    if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
      this.logger.error('Invalid configuration path', { path } as any);
      return false;
    }
    current[lastKey] = value;
    
    // Record the change
    const update: ConfigUpdate = {
      path: keys.concat([lastKey]),
      oldValue,
      newValue: value,
      timestamp: Date.now(),
      source
    };
    
    this.configHistory.push(update);
    
    // Notify watchers
    this.notifyWatchers(path);
    
    this.logger.info('Configuration updated', { path, value, source });
    return true;
  }

  public validateConfiguration(): ConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate all configuration paths
    for (const [path, validator] of this.validationRules) {
      const value = this.getValue(path);
      if (value === undefined) {
        errors.push(`Missing configuration: ${path}`);
      } else if (typeof validator !== 'function' || !validator(value)) {
        errors.push(`Invalid configuration: ${path} = ${value}`);
      }
    }
    
    // Additional validation rules
    if (this.config.agi.maxAgents > 50) {
      warnings.push('High number of agents may impact performance');
    }
    
    if (this.config.memory.shortTermCapacity > 10000) {
      warnings.push('Large short-term memory capacity may impact performance');
    }
    
    if (this.config.performance.maxResponseTime > 30000) {
      warnings.push('High response time limit may impact user experience');
    }
    
    if (this.config.services.openai.enabled && !this.config.services.openai.apiKey) {
      errors.push('OpenAI API key is required when OpenAI service is enabled');
    }
    
    if (this.config.services.anthropic.enabled && !this.config.services.anthropic.apiKey) {
      errors.push('Anthropic API key is required when Anthropic service is enabled');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public watchConfiguration(path: string, callback: (config: SystemConfig) => void): void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, []);
    }
    this.watchers.get(path)!.push(callback);
  }

  public unwatchConfiguration(path: string, callback: (config: SystemConfig) => void): void {
    const watchers = this.watchers.get(path);
    if (watchers) {
      const index = watchers.indexOf(callback);
      if (index > -1) {
        watchers.splice(index, 1);
      }
    }
  }

  private notifyWatchers(path: string): void {
    const watchers = this.watchers.get(path);
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(this.getConfiguration());
        } catch (error) {
          this.logger.error('Error in configuration watcher', { path, error } as any);
        }
      });
    }
  }

  public getConfigurationHistory(): ConfigUpdate[] {
    return [...this.configHistory];
  }

  public resetConfiguration(): void {
    this.config = this.createDefaultConfig();
    this.configHistory = [];
    this.loadConfiguration();
    this.logger.info('Configuration reset to defaults');
  }

  public exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  public importConfiguration(configJson: string): boolean {
    try {
      const newConfig = JSON.parse(configJson);
      const validation = this.validateConfiguration();
      
      if (!validation.isValid) {
        this.logger.error('Invalid configuration import', { errors: validation.errors } as any);
        return false;
      }
      
      this.config = newConfig;
      this.logger.info('Configuration imported successfully');
      return true;
      
    } catch (error) {
      this.logger.error('Failed to import configuration', error as Error);
      return false;
    }
  }

  public getFeatureFlags(): Record<string, boolean> {
    return this.config.features;
  }

  public isFeatureEnabled(feature: keyof SystemConfig['features']): boolean {
    return this.config.features[feature];
  }

  public enableFeature(feature: keyof SystemConfig['features']): void {
    this.setValue(`features.${feature}`, true, 'feature_enable');
  }

  public disableFeature(feature: keyof SystemConfig['features']): void {
    this.setValue(`features.${feature}`, false, 'feature_disable');
  }

  public getServiceConfig(serviceName: keyof SystemConfig['services']): any {
    return this.config.services[serviceName];
  }

  public isServiceEnabled(serviceName: keyof SystemConfig['services']): boolean {
    const serviceConfig = this.config.services[serviceName];
    return serviceConfig && serviceConfig.enabled;
  }

  public getEnvironment(): string {
    return this.config.system.environment;
  }

  public isDevelopment(): boolean {
    return this.config.system.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.system.environment === 'production';
  }

  public isDebugEnabled(): boolean {
    return this.config.system.debug;
  }

  public getLogLevel(): string {
    return this.config.system.logLevel;
  }

  public getPerformanceConfig(): SystemConfig['performance'] {
    return this.config.performance;
  }

  public getSecurityConfig(): SystemConfig['security'] {
    return this.config.security;
  }

  public getMemoryConfig(): SystemConfig['memory'] {
    return this.config.memory;
  }

  public getAGIConfig(): SystemConfig['agi'] {
    return this.config.agi;
  }

  public getMonitoringConfig(): SystemConfig['monitoring'] {
    return this.config.monitoring;
  }
} 