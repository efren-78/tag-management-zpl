using LabelPrinterMVP.Validation;

namespace LabelPrinterMVP.Tests;

public class ZplSecurityValidatorTests
{
    private const string ValidZpl = "^XA^PW800^LL600^FO50,50^A0N,40,40^FDProducto Valido^FS^XZ";

    [Fact] // Test para validar que un código ZPL legítimo es aceptado sin errores
    public void Validate_ValidZpl_ShouldReturnTrue()
    {
        // Act
        var result = ZplSecurityValidator.Validate(ValidZpl);

        // Assert
        Assert.True(result.IsValid);
        Assert.Null(result.ErrorMessage);
        Assert.Null(result.DetectedThreat);
    }

    [Theory] // Test para verificar que contenido nulo o con espacios en blanco es rechazado
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \t\r\n  ")]
    public void Validate_NullOrWhitespace_ShouldReturnFalse(string? emptyZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(emptyZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("vacío", result.ErrorMessage);
    }

    [Fact] // Test para verificar que la falta de etiqueta de inicio ^XA es detectada
    public void Validate_MissingOpeningXA_ShouldReturnFalse()
    {
        // Arrange
        var invalidZpl = "^FO50,50^A0N,30,30^FDTest^FS^XZ";

        // Act
        var result = ZplSecurityValidator.Validate(invalidZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("^XA", result.ErrorMessage);
    }

    [Fact] // Test para verificar que la falta de etiqueta de cierre ^XZ es detectada
    public void Validate_MissingClosingXZ_ShouldReturnFalse()
    {
        // Arrange
        var invalidZpl = "^XA^FO50,50^A0N,30,30^FDTest^FS";

        // Act
        var result = ZplSecurityValidator.Validate(invalidZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("^XZ", result.ErrorMessage);
    }

    [Fact] // Test para verificar que bloques ^XA y ^XZ desbalanceados son rechazados
    public void Validate_UnbalancedBlocks_ShouldReturnFalse()
    {
        // Arrange: 2 aperturas ^XA y solo 1 cierre ^XZ
        var unbalancedZpl = "^XA^FO50,50^FD1^FS^XA^FO50,100^FD2^FS^XZ";

        // Act
        var result = ZplSecurityValidator.Validate(unbalancedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("desbalanceados", result.ErrorMessage);
    }

    [Theory] // Test para detectar inyección de reinicio forzado de hardware (~JR o ^JR)
    [InlineData("^XA^FO50,50^FDTest^FS^XZ~JR")]
    [InlineData("^XA^FO50,50^FDTest^FS~jr^XZ")]
    [InlineData("~JR^XA^FO50,50^FDTest^FS^XZ")]
    public void Validate_HardwareResetInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("Reinicio forzado", result.ErrorMessage);
    }

    [Theory] // Test para detectar inyección de cancelación masiva de trabajos de impresión (~JA o ^JA)
    [InlineData("^XA^FO50,50^FDTest^FS^XZ~JA")]
    [InlineData("^XA~ja^XZ")]
    public void Validate_CancelAllJobsInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("Cancelación forzada", result.ErrorMessage);
    }

    [Theory] // Test para detectar inyección de borrado de archivos o memoria flash (^ID)
    [InlineData("^XA^IDE:*.*^XZ")]
    [InlineData("^XA^IDR:LOGO.GRF^XZ")]
    [InlineData("^XA^FO50,50^FDTest^FS^idb:*^XZ")]
    public void Validate_MemoryDeletionInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("borrado de archivos o memoria flash", result.ErrorMessage);
    }

    [Theory] // Test para detectar inyección de restauración de fábrica o reconfiguración persistente (^JU)
    [InlineData("^XA^JUF^XZ")]
    [InlineData("^XA^JUR^XZ")]
    [InlineData("^XA^JUS^XZ")]
    public void Validate_ConfigurationOrFactoryResetInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("restauración de fábrica", result.ErrorMessage);
    }

    [Theory] // Test para detectar alteración de red e IP (^NC, ^ND, ^NR, ^NI)
    [InlineData("^XA^NR^XZ")]
    [InlineData("^XA^NI 192.168.1.100^XZ")]
    public void Validate_NetworkConfigInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("configuración de red", result.ErrorMessage);
    }

    [Theory] // Test para detectar inyección de scripts SGD (Set-Get-Do)
    [InlineData("! U1 do \"device.reset\" \"\"\r\n^XA^FO50,50^FDTest^FS^XZ")]
    [InlineData("^XA^FO50,50^FDTest^FS^XZ\r\n! U1 setvar \"ip.active_network\" \"off\"")]
    public void Validate_SgdCommandInjection_ShouldReject(string injectedZpl)
    {
        // Act
        var result = ZplSecurityValidator.Validate(injectedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("SGD", result.ErrorMessage);
    }

    [Fact] // Test para verificar que tamaños de ZPL desproporcionados son rechazados para evitar DoS
    public void Validate_ExceedingSizeLimit_ShouldReject()
    {
        // Arrange: Cadena de más de 1 MB
        var oversizedZpl = "^XA" + new string('A', 1_048_577) + "^XZ";

        // Act
        var result = ZplSecurityValidator.Validate(oversizedZpl);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("límite seguro", result.ErrorMessage);
    }
}
