using System.Text.RegularExpressions;

namespace LabelPrinterMVP.Validation;

public record ZplValidationResult(bool IsValid, string? ErrorMessage, string? DetectedThreat = null);

/// <summary>
/// Validador de seguridad para inspeccionar código ZPL entrante y prevenir inyecciones
/// de comandos destructivos, resets de hardware, borrado de memoria o reconfiguración de la impresora Zebra.
/// </summary>
public static class ZplSecurityValidator
{
    // Límite máximo de tamaño razonable para una etiqueta ZPL (1 MB) para prevenir DoS en la memoria de la impresora
    private const int MaxZplLength = 1_048_576;

    /// <summary>
    /// Reglas de detección de comandos de control destructivos o maliciosos en ZPL y SGD.
    /// </summary>
    private static readonly (string Pattern, string Description)[] DangerousPatterns = new[]
    {
        // Reinicio físico de hardware de la impresora
        (@"(~JR|\^JR)", "Reinicio forzado de hardware (Power-On Reset)"),

        // Cancelar todos los trabajos de impresión en la cola del dispositivo
        (@"(~JA|\^JA)", "Cancelación forzada de todos los trabajos en cola (Cancel All)"),

        // Reinicio de búfer de recepción
        (@"(~JB|\^JB)", "Reinicio del búfer de recepción (Reset Buffer)"),

        // Borrado de objetos/formatos en memoria Flash / DRAM / EPROM (^IDE:, ^IDR:, etc.)
        (@"\^ID[A-Z0-9_*?:.]*", "Comando de borrado de archivos o memoria flash (^ID)"),

        // Reset a fábrica o actualización de configuración persistente (^JUF, ^JUR, ^JUS)
        (@"\^JU[FRS]", "Comando de reconfiguración o restauración de fábrica (^JU)"),

        // Reconfiguración de red, reinicio de adaptador o cambio de IP (^NC, ^ND, ^NR, ^NI)
        (@"\^(NC|ND|NR|NI)\b", "Comando de modificación de configuración de red Zebra (^N*)"),

        // Comandos SGD (Set-Get-Do) que ejecutan scripts directos en el sistema operativo Zebra (ej: ! U1 do "device.reset")
        (@"!\s*U1?\s+(do|setvar|getvar)\b", "Comando SGD (Set-Get-Do) del sistema operativo Zebra")
    };

    /// <summary>
    /// Valida si una cadena ZPL es segura para ser procesada y enviada al hardware de impresión.
    /// </summary>
    public static ZplValidationResult Validate(string? zpl)
    {
        if (string.IsNullOrWhiteSpace(zpl))
        {
            return new ZplValidationResult(false, "El contenido ZPL no puede estar vacío.");
        }

        if (zpl.Length > MaxZplLength)
        {
            return new ZplValidationResult(false, $"El tamaño del ZPL excede el límite seguro permitido de {MaxZplLength / 1024} KB.");
        }

        // 1. Detectar comandos maliciosos o destructivos (case-insensitive)
        foreach (var (pattern, description) in DangerousPatterns)
        {
            var match = Regex.Match(zpl, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return new ZplValidationResult(
                    false,
                    $"Se detectó un comando ZPL no autorizado o potencialmente dañino: '{match.Value}' ({description}).",
                    match.Value
                );
            }
        }

        // 2. Validación de estructura básica: debe contener delimitadores de formato de etiqueta (^XA y ^XZ)
        int openTags = Regex.Matches(zpl, @"\^XA", RegexOptions.IgnoreCase).Count;
        int closeTags = Regex.Matches(zpl, @"\^XZ", RegexOptions.IgnoreCase).Count;

        if (openTags == 0)
        {
            return new ZplValidationResult(false, "El código ZPL carece de etiqueta de inicio (^XA).");
        }

        if (closeTags == 0)
        {
            return new ZplValidationResult(false, "El código ZPL carece de etiqueta de cierre (^XZ).");
        }

        if (openTags != closeTags)
        {
            return new ZplValidationResult(false, $"Bloques ZPL desbalanceados: se encontraron {openTags} etiquetas ^XA y {closeTags} etiquetas ^XZ.");
        }

        return new ZplValidationResult(true, null);
    }
}
