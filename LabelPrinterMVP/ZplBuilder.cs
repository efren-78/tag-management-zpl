using System.Text;

namespace LabelPrinterMVP;

/// <summary>
/// Arma el string ZPL para una plantilla fija de etiqueta:
/// nombre de producto + código de barras (Code 128) + fecha + numero de copias.
///
/// Referencia rápida de comandos usados:
/// ^XA / ^XZ  -> inicio / fin de la etiqueta
/// ^PW        -> ancho de impresión (en puntos, 203 dpi por defecto en la 110xi4)
/// ^LL        -> largo de la etiqueta (en puntos)
/// ^FO x,y    -> posición del siguiente campo
/// ^A0N,h,w   -> fuente y tamaño
/// ^FD ... ^FS-> contenido del campo
/// ^BY        -> ancho de módulo del código de barras
/// ^BCN,h     -> código de barras Code 128
/// </summary>
public static class ZplBuilder
{
    // 203 dpi: 1 pulgada = 203 puntos. 
    // Ajustar si la impresora Zebra 110xi4 está a 300 dpi.
    private const int Dpi = 203;

    public static string BuildLabel(LabelData data, double widthInches = 4, double heightInches = 3)
    {
        int widthDots = (int)(widthInches * Dpi);
        int heightDots = (int)(heightInches * Dpi);

        var sb = new StringBuilder();
        sb.AppendLine("^XA");
        sb.AppendLine($"^PW{widthDots}");
        sb.AppendLine($"^LL{heightDots}");

        // Nombre del producto
        sb.AppendLine("^FO50,50");
        sb.AppendLine("^A0N,40,40");
        sb.AppendLine($"^FD{Escape(data.ProductName)}^FS");

        // Fecha
        sb.AppendLine("^FO50,110");
        sb.AppendLine("^A0N,30,30");
        sb.AppendLine($"^FD{data.Date:yyyy-MM-dd}^FS");

        // Código de barras (Code 128)
        sb.AppendLine("^FO50,170");
        sb.AppendLine("^BY2");
        sb.AppendLine("^BCN,100,Y,N,N");
        sb.AppendLine($"^FD{Escape(data.Code)}^FS");

        // Numero de copias
        sb.AppendLine($"^PQ{data.Copies},1,1,N");
        sb.AppendLine("^XZ");

        return sb.ToString();
    }

    // ZPL usa ^ y ~ como caracteres de control; los quitamos de los datos del usuario
    // para no romper el comando si alguien los escribe por accidente.
    private static string Escape(string value)
        => value.Replace("^", "").Replace("~", "");
}
