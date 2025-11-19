// src/routes/password.js
const express = require('express');
const passwordService = require('../services/passwordService');
const { analyzePasswordSimilarity, findSimilarPasswords } = require('../utils/commonPasswords');

const router = express.Router();

router.post('/evaluate', async (req, res) => {
  try {
    if (!req.body.password) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        message: 'El campo "password" es obligatorio'
      });
    }

    if (typeof req.body.password !== 'string') {
      return res.status(400).json({
        error: 'Tipo de dato incorrecto',
        message: 'El campo "password" debe ser una cadena de texto'
      });
    }

    if (req.body.password.length === 0) {
      return res.status(400).json({
        error: 'Contraseña vacía',
        message: 'La contraseña no puede estar vacía'
      });
    }

    if (req.body.password.length > 1000) {
      return res.status(400).json({
        error: 'Contraseña demasiado larga',
        message: 'La contraseña no puede exceder 1000 caracteres'
      });
    }

    const password = req.body.password;
    const startTime = Date.now();
    console.log(`Evaluando contraseña de ${password.length} caracteres`);

    const evaluation = await passwordService.evaluatePassword(password);
    const endTime = Date.now();

    console.log(`✅ Evaluación completada en ${endTime - startTime}ms`);

    res.status(200).json({
      password: password,
      entropy: evaluation.entropy,
      strength: evaluation.strength,
      estimated_crack_time_seconds: evaluation.estimatedCrackTimeSeconds,
      similarity_analysis: {
        is_common: evaluation.similarityAnalysis.isCommon,
        has_similar: evaluation.similarityAnalysis.hasSimilar,
        similar_passwords: evaluation.similarityAnalysis.similarPasswords,
        message: evaluation.similarityAnalysis.message,
        recommendation: evaluation.similarityAnalysis.recommendation,
        security_level: evaluation.similarityAnalysis.securityLevel
      },
      suggestions: evaluation.suggestions,
      metadata: {
        length: evaluation.metadata.length,
        character_types: evaluation.metadata.characterTypes,
        alphabet_size: evaluation.metadata.alphabetSize,
        is_common_password: evaluation.metadata.isCommonPassword,
        evaluation_time_ms: endTime - startTime
      }
    });

  } catch (error) {
    console.error('Error evaluando contraseña:', error.message);
    console.error(error.stack);
    
    res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo evaluar la contraseña. Intente nuevamente.'
    });
  }
});

router.post('/similarity', async (req, res) => {
  try {
    if (!req.body.password) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        message: 'El campo "password" es obligatorio'
      });
    }

    if (typeof req.body.password !== 'string') {
      return res.status(400).json({
        error: 'Tipo de dato incorrecto',
        message: 'El campo "password" debe ser una cadena de texto'
      });
    }

    const password = req.body.password;
    const maxResults = Math.min(req.body.max_results || 5, 10); // Máximo 10
    const minSimilarity = Math.max(req.body.min_similarity || 0.7, 0.5); // Mínimo 0.5

    console.log(`Analizando similitud para contraseña de ${password.length} caracteres`);

    const similarityAnalysis = await analyzePasswordSimilarity(password);
    const similarPasswords = await findSimilarPasswords(password, maxResults, minSimilarity);

    res.status(200).json({
      password: password,
      is_common: similarityAnalysis.isCommon,
      has_similar: similarityAnalysis.hasSimilar,
      similar_passwords: similarPasswords,
      analysis: {
        message: similarityAnalysis.message,
        recommendation: similarityAnalysis.recommendation,
        security_level: similarityAnalysis.securityLevel
      },
      search_parameters: {
        max_results: maxResults,
        min_similarity: minSimilarity
      }
    });

  } catch (error) {
    console.error('Error analizando similitud:', error.message);
    
    res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo analizar la similitud de la contraseña. Intente nuevamente.'
    });
  }
});

router.get('/info', (req, res) => {
  res.status(200).json({
    criteria: {
      entropy_calculation: 'E = L × log2(N), donde L=longitud y N=tamaño del alfabeto',
      alphabet_sizes: {
        lowercase: 26,
        uppercase: 26,
        numbers: 10,
        symbols: 32
      },
      strength_classification: {
        'Muy Débil': '< 30 bits o contraseña común',
        'Débil': '30 - 45 bits de entropía',
        'Aceptable': '45 - 60 bits de entropía',
        'Fuerte': '60 - 80 bits de entropía',
        'Muy Fuerte': '80+ bits de entropía'
      },
      crack_time_calculation: {
        attack_rate: '10^11 intentos por segundo',
        formula: 'tiempo = 2^entropía / (2 × tasa_de_ataque)'
      },
      similarity_analysis: {
        description: 'Análisis de similitud con contraseñas comunes',
        types: {
          'identical': 'Contraseña idéntica en la base de datos',
          'simple_variation': 'Variación simple (mayúsculas, números agregados)',
          'similar': 'Contraseña similar basada en distancia de edición (Levenshtein)'
        },
        similarity_threshold: 'Mínimo 70% de similitud para ser considerada similar',
        security_levels: {
          'very_low': 'Contraseña muy insegura (común o idéntica)',
          'low': 'Contraseña insegura (variación simple)',
          'medium_low': 'Contraseña con similitudes preocupantes',
          'acceptable': 'Contraseña aceptable (sin similitudes encontradas)'
        }
      }
    },
    endpoints: {
      '/password/evaluate': 'POST - Evaluación completa de contraseña',
      '/password/similarity': 'POST - Análisis específico de similitud',
      '/password/info': 'GET - Información sobre criterios de evaluación'
    },
    database: {
      total_passwords: 961883,
      performance: '1-10ms por evaluación'
    }
  });
});

module.exports = router;