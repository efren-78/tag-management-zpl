namespace LabelPrinterMVP.DTOs.Responses;

/// <summary>
/// Respuesta estándar de la API para operaciones de impresión y generación ZPL.
/// </summary>
public class PrintResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Zpl { get; set; }

    public PrintResponse() { }

    public PrintResponse(bool success, string? message, string? zpl = null)
    {
        Success = success;
        Message = message;
        Zpl = zpl;
    }
}
