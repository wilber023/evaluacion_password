// src/services/passwordService.js
const { analyzePasswordSimilarity } = require('../utils/commonPasswords');

class PasswordService {
    constructor() {
        this.ATTACK_RATE = Math.pow(10, 11);
        this.ALPHABET_SIZES = {
            lowercase: 26,
            uppercase: 26,
            numbers: 10,
            symbols: 32
        };
        
        // CRITERIOS MÁS ESTRICTOS
        this.STRENGTH_LEVELS = {
            VERY_WEAK: 'Muy Débil',
            WEAK: 'Débil',
            ACCEPTABLE: 'Aceptable',
            STRONG: 'Fuerte',
            VERY_STRONG: 'Muy Fuerte'
        };
        
        // LÍMITES MÁS ESTRICTOS
        this.ENTROPY_THRESHOLDS = {
            VERY_WEAK: 30,    // < 30 bits = Muy Débil
            WEAK: 45,         // 30-45 bits = Débil  
            ACCEPTABLE: 60,   // 45-60 bits = Aceptable
            STRONG: 80,       // 60-80 bits = Fuerte
            VERY_STRONG: 80   // > 80 bits = Muy Fuerte
        };
    }

    detectCharacterTypes(password) {
        return {
            hasLowercase: /[a-z]/.test(password),
            hasUppercase: /[A-Z]/.test(password),
            hasNumbers: /[0-9]/.test(password),
            hasSymbols: /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(password)
        };
    }

    calculateAlphabetSize(characterTypes) {
        let alphabetSize = 0;
        if (characterTypes.hasLowercase) alphabetSize += this.ALPHABET_SIZES.lowercase;
        if (characterTypes.hasUppercase) alphabetSize += this.ALPHABET_SIZES.uppercase;
        if (characterTypes.hasNumbers) alphabetSize += this.ALPHABET_SIZES.numbers;
        if (characterTypes.hasSymbols) alphabetSize += this.ALPHABET_SIZES.symbols;
        return alphabetSize || this.ALPHABET_SIZES.lowercase;
    }

    calculateEntropy(password) {
        const length = password.length;
        const characterTypes = this.detectCharacterTypes(password);
        const alphabetSize = this.calculateAlphabetSize(characterTypes);
        const entropy = length * Math.log2(alphabetSize);
        return Math.round(entropy * 100) / 100;
    }

    classifyStrength(entropy, isCommon, password) {
        // Si es común, automáticamente Muy Débil
        if (isCommon) return this.STRENGTH_LEVELS.VERY_WEAK;
        
        // Penalización por longitud muy corta
        if (password.length < 6) return this.STRENGTH_LEVELS.VERY_WEAK;
        
        // Penalización por solo un tipo de carácter
        const charTypes = this.detectCharacterTypes(password);
        const typeCount = Object.values(charTypes).filter(Boolean).length;
        if (typeCount === 1 && password.length < 12) return this.STRENGTH_LEVELS.VERY_WEAK;
        
        // Clasificación por entropía
        if (entropy < this.ENTROPY_THRESHOLDS.VERY_WEAK) return this.STRENGTH_LEVELS.VERY_WEAK;
        if (entropy < this.ENTROPY_THRESHOLDS.WEAK) return this.STRENGTH_LEVELS.WEAK;
        if (entropy < this.ENTROPY_THRESHOLDS.ACCEPTABLE) return this.STRENGTH_LEVELS.ACCEPTABLE;
        if (entropy < this.ENTROPY_THRESHOLDS.STRONG) return this.STRENGTH_LEVELS.STRONG;
        return this.STRENGTH_LEVELS.VERY_STRONG;
    }

    calculateCrackTime(entropy, isCommon) {
        if (isCommon) return 0.001; // Más realista para contraseñas comunes
        
        const totalCombinations = Math.pow(2, entropy);
        const crackTimeSeconds = totalCombinations / (2 * this.ATTACK_RATE);
        
        // Asegurar que contraseñas muy débiles tengan tiempo de crackeo bajo
        return Math.max(0.001, Math.round(crackTimeSeconds * 100) / 100);
    }

    applyCommonPasswordPenalty(entropy, isCommon) {
        if (isCommon) {
            return Math.max(10, Math.round(entropy * 0.5 * 100) / 100); // Penalización más severa
        }
        return entropy;
    }

    async evaluatePassword(password) {
        try {
            const similarityAnalysis = await analyzePasswordSimilarity(password);
            const isCommon = similarityAnalysis.isCommon;
            
            let entropy = this.calculateEntropy(password);
            entropy = this.applyCommonPasswordPenalty(entropy, isCommon);
            
            const strength = this.classifyStrength(entropy, isCommon, password);
            const estimatedCrackTimeSeconds = this.calculateCrackTime(entropy, isCommon);
            const suggestions = this.generatePasswordSuggestions(password, similarityAnalysis, strength);

            return {
                entropy,
                strength,
                estimatedCrackTimeSeconds,
                similarityAnalysis,
                suggestions,
                metadata: {
                    length: password.length,
                    characterTypes: this.detectCharacterTypes(password),
                    alphabetSize: this.calculateAlphabetSize(this.detectCharacterTypes(password)),
                    isCommonPassword: isCommon,
                    characterTypeCount: Object.values(this.detectCharacterTypes(password)).filter(Boolean).length
                }
            };

        } catch (error) {
            console.error('Error en evaluatePassword:', error.message);
            throw new Error('Error al evaluar la contraseña');
        }
    }

    generatePasswordSuggestions(password, similarityAnalysis, strength) {
        const suggestions = [];
        const characterTypes = this.detectCharacterTypes(password);
        const typeCount = Object.values(characterTypes).filter(Boolean).length;

        // Sugerencias CRÍTICAS para contraseñas muy débiles
        if (strength === this.STRENGTH_LEVELS.VERY_WEAK) {
            if (password.length < 8) {
                suggestions.push({
                    type: 'critical',
                    message: 'CONTRASEÑA MUY CORTA - Usar al menos 8 caracteres',
                    reason: 'Contraseñas menores a 8 caracteres son extremadamente vulnerables'
                });
            }
            
            if (typeCount === 1) {
                suggestions.push({
                    type: 'critical', 
                    message: 'VARIEDAD DE CARACTERES INSUFICIENTE',
                    reason: 'Usar combinación de mayúsculas, minúsculas, números y símbolos'
                });
            }
        }

        if (similarityAnalysis.isCommon) {
            suggestions.push({
                type: 'critical',
                message: 'CONTRASEÑA COMPROMETIDA - Cambiar inmediatamente',
                reason: 'Esta contraseña aparece en listas de contraseñas filtradas globalmente'
            });
        }

        // Sugerencias de MEJORA específicas
        if (!characterTypes.hasUppercase) {
            suggestions.push({
                type: strength === this.STRENGTH_LEVELS.VERY_WEAK ? 'critical' : 'improvement',
                message: 'Agregar letras mayúsculas',
                reason: 'Aumenta significativamente la complejidad'
            });
        }
        
        if (!characterTypes.hasNumbers) {
            suggestions.push({
                type: strength === this.STRENGTH_LEVELS.VERY_WEAK ? 'critical' : 'improvement',
                message: 'Agregar números',
                reason: 'Expande el conjunto de caracteres disponibles'
            });
        }
        
        if (!characterTypes.hasSymbols) {
            suggestions.push({
                type: 'improvement',
                message: 'Agregar símbolos especiales (!@#$%^&*)',
                reason: 'Maximiza la complejidad del alfabeto'
            });
        }
        
        if (password.length < 12 && strength !== this.STRENGTH_LEVELS.VERY_STRONG) {
            suggestions.push({
                type: password.length < 8 ? 'critical' : 'improvement',
                message: `Longitud actual: ${password.length} caracteres - Recomendado: 12+`,
                reason: 'Cada carácter adicional aumenta exponencialmente la seguridad'
            });
        }

        // Mensaje de éxito solo para contraseñas fuertes
        if (strength === this.STRENGTH_LEVELS.VERY_STRONG) {
            suggestions.push({
                type: 'success',
                message: '¡Excelente contraseña!',
                reason: 'Cumple con los más altos estándares de seguridad'
            });
        }

        return suggestions;
    }

    getEvaluationCriteria() {
        return {
            strengthLevels: this.STRENGTH_LEVELS,
            entropyThresholds: this.ENTROPY_THRESHOLDS,
            minimumRequirements: {
                length: '8 caracteres mínimo, 12+ recomendado',
                characterTypes: 'Mínimo 2 tipos diferentes (ej: letras + números)',
                entropy: 'Mínimo 45 bits para ser aceptable'
            }
        };
    }
}

module.exports = new PasswordService();