namespace LabelPrinterMVP.DTOs.Requests;

/// <summary>
/// Solicitud para generar código ZPL a partir de los datos de una etiqueta.
/// </summary>
public class BuildLabelRequest
{
    public string ProductName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int Copies { get; set; } = 1;
    public double WidthInches { get; set; } = 4;
    public double HeightInches { get; set; } = 3;
}
