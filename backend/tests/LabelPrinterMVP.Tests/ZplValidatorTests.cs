using LabelPrinterMVP.Validation;

namespace LabelPrinterMVP.Tests;

public class ZplValidatorTests
{
    [Fact] //Test para evaluar cuando el ZPL esta vacio
    public void Validate_ShouldReturnFalse_WhenZplIsEmpty()
    {
        // Arrange
        string zpl = "";
        
        // Act
        var result = ZplSecurityValidator.Validate(zpl);
        
        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("no puede estar vacío", result.ErrorMessage);
    }

    [Fact] //Test para evaluar cuando el ZPL es demasiado grande
    public void Validate_ShouldReturnFalse_WhenZplIsTooLarge()
    {
        // Arrange
        string zpl = new string('Z', 1024 * 1024 + 1);
        
        // Act
        var result = ZplSecurityValidator.Validate(zpl);
        
        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("excede el límite seguro permitido", result.ErrorMessage);
    }

    [Fact] //Test para evaluar cuando el ZPL tiene comandos de control destructivos
    public void Validate_ShouldReturnFalse_WhenZplContainsDangerousCommands()
    {
        // Arrange
        string zpl = "^XA^FO50,50^FDTest^FS^XZ^JR";
        
        // Act
        var result = ZplSecurityValidator.Validate(zpl);
        
        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("comando ZPL no autorizado", result.ErrorMessage);
    }
}