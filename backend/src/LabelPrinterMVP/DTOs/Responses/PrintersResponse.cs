namespace LabelPrinterMVP.DTOs.Responses;

/// <summary>
/// Respuesta que contiene la lista de impresoras disponibles y su conteo total.
/// </summary>
public class PrintersResponse
{
    public List<string> Printers { get; set; } = new();
    public int Count { get; set; }

    public PrintersResponse() { }

    public PrintersResponse(List<string> printers)
    {
        Printers = printers;
        Count = printers.Count;
    }
}
