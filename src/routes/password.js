const express = require('express');
const passwordService = require('../services/passwordService');

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
    console.log(`Evaluando contraseña de ${password.length} caracteres`);

    const evaluation = await passwordService.evaluatePassword(password);

    res.status(200).json({
      password: password,
      entropy: evaluation.entropy,
      strength: evaluation.strength,
      estimated_crack_time_seconds: evaluation.estimatedCrackTimeSeconds
    });

  } catch (error) {
    console.error('Error evaluando contraseña:', error.message);
    
    res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo evaluar la contraseña. Intente nuevamente.'
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
        'Muy Débil (común)': 'Contraseña encontrada en lista de contraseñas comunes',
        'Débil o Aceptable': '0 - 60 bits de entropía',
        'Fuerte': '60 - 80 bits de entropía',
        'Muy Fuerte': '80+ bits de entropía'
      },
      crack_time_calculation: {
        attack_rate: '10^11 intentos por segundo',
        formula: 'tiempo = 2^entropía / tasa_de_ataque'
      }
    }
  });
});

module.exports = router;