namespace LabelPrinterMVP.DTOs.Requests;

/// <summary>
/// Solicitud para enviar ZPL directamente a una impresora por TCP/IP.
/// </summary>
public class TcpPrintRequest
{
    public string Zpl { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 9100;
}
