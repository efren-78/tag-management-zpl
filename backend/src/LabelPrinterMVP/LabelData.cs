namespace LabelPrinterMVP;

/// <summary>
/// Datos variables que se insertan en la plantilla de etiqueta.
/// Ajustar los campos según lo que realmente se necesite imprimir.
/// </summary>
public class LabelData
{
    public string ProductName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;       // para el código de barras
    public int Copies { get; set; } = 0;    // numero de copias
    public DateTime Date { get; set; } = DateTime.Now;

    public override string ToString()
        => $"{ProductName} | {Code} | {Date:yyyy-MM-dd}";
}
