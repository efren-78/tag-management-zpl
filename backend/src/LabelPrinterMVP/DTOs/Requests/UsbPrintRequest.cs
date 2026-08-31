namespace LabelPrinterMVP.DTOs.Requests;

/// <summary>
/// Solicitud para enviar ZPL a una impresora USB conectada al equipo Windows.
/// </summary>
public class UsbPrintRequest
{
    public string Zpl { get; set; } = string.Empty;
    public string PrinterName { get; set; } = string.Empty;
}
