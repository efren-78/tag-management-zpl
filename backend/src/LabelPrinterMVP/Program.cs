using LabelPrinterMVP;
using System.IO;
using System.Text;

Console.WriteLine("=== MVP Sistema de Etiquetas - Zebra 110xi4 ===\n");

Console.WriteLine("Seleccione una opción:");
Console.WriteLine("1. Crear una nueva etiqueta (Ingresar datos)");
Console.WriteLine("2. Leer un archivo .prn existente para imprimir");
Console.Write("Opción (1 o 2) [por defecto 1]: ");
string optionChoice = (Console.ReadLine() ?? "").Trim();

string zpl = "";

if (optionChoice == "2")
{
    Console.Write("\nIngrese la ruta del archivo .prn [por defecto 1.prn]: ");
    string prnPath = (Console.ReadLine() ?? "").Trim();
    if (string.IsNullOrEmpty(prnPath))
    {
        prnPath = "1.prn";
    }

    if (!File.Exists(prnPath))
    {
        Console.WriteLine($"Error: El archivo '{prnPath}' no existe.");
        return;
    }

    try
    {
        zpl = File.ReadAllText(prnPath, Encoding.UTF8);
        Console.WriteLine($"\nArchivo '{prnPath}' leído con éxito ({zpl.Length} caracteres).");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error al leer el archivo: {ex.Message}");
        return;
    }
}
else
{
    Console.Write("\nNombre del producto: ");
    string productName = Console.ReadLine() ?? "";

    Console.Write("Código (para el código de barras): ");
    string code = Console.ReadLine() ?? "";

    Console.Write("Número de copias [por defecto 1]: ");
    string copiesInput = Console.ReadLine() ?? "";
    if (!int.TryParse(copiesInput, out int copies) || copies <= 0)
    {
        copies = 1;
    }

    var data = new LabelData
    {
        ProductName = productName,
        Code = code,
        Copies = copies,
        Date = DateTime.Now
    };

    zpl = ZplBuilder.BuildLabel(data);

    Console.WriteLine("\n--- ZPL generado ---");
    Console.WriteLine(zpl);
    Console.WriteLine("--------------------\n");

    Console.Write("¿Desea guardar la etiqueta generada en un archivo .prn? (s/n): ");
    if ((Console.ReadLine() ?? "").Trim().ToLower() == "s")
    {
        Console.Write("Nombre o ruta del archivo [por defecto label_output.prn]: ");
        string savePath = (Console.ReadLine() ?? "").Trim();
        if (string.IsNullOrEmpty(savePath))
        {
            savePath = "label_output.prn";
        }

        try
        {
            File.WriteAllText(savePath, zpl, Encoding.UTF8);
            Console.WriteLine($"Etiqueta guardada con éxito en '{savePath}'.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error al guardar el archivo: {ex.Message}");
        }
    }
}

Console.WriteLine("\nSeleccione el método de conexión para imprimir:");
Console.WriteLine("1. Red TCP/IP (Ethernet / Wi-Fi)");
Console.WriteLine("2. USB (Impresora de Windows)");
Console.Write("Opción (1 o 2) [por defecto 1]: ");
string modeChoice = (Console.ReadLine() ?? "").Trim();

if (modeChoice == "2")
{
    Console.WriteLine("\nBuscando impresoras instaladas en el sistema...");
    var printers = ZebraUsbPrinterClient.GetInstalledPrinters();
    string selectedPrinter = "";

    if (printers.Count > 0)
    {
        Console.WriteLine("Impresoras disponibles:");
        for (int i = 0; i < printers.Count; i++)
        {
            Console.WriteLine($"  [{i + 1}] {printers[i]}");
        }
        Console.Write($"Seleccione número (1-{printers.Count}) o escriba el nombre: ");
        string printerChoice = (Console.ReadLine() ?? "").Trim();

        if (int.TryParse(printerChoice, out int idx) && idx >= 1 && idx <= printers.Count)
        {
            selectedPrinter = printers[idx - 1];
        }
        else if (!string.IsNullOrEmpty(printerChoice))
        {
            selectedPrinter = printerChoice;
        }
        else
        {
            selectedPrinter = printers[0];
        }
    }
    else
    {
        Console.Write("Nombre de la impresora USB (ej. Zebra 110xi4): ");
        selectedPrinter = Console.ReadLine() ?? "Zebra 110xi4";
    }

    Console.WriteLine($"\nImpresora USB seleccionada: '{selectedPrinter}'");
    Console.Write("¿Enviar a la impresora USB? (s/n): ");
    if ((Console.ReadLine() ?? "").Trim().ToLower() == "s")
    {
        var (success, error) = await ZebraUsbPrinterClient.SendAsync(selectedPrinter, zpl);

        if (success)
            Console.WriteLine("Etiqueta enviada correctamente a la impresora USB.");
        else
            Console.WriteLine($"Error: {error}");
    }
    else
    {
        Console.WriteLine("Cancelado.");
    }
}
else
{
    Console.Write("IP de la impresora (o del simulador, ej. 127.0.0.1): ");
    string host = Console.ReadLine() ?? "127.0.0.1";
    if (string.IsNullOrWhiteSpace(host)) host = "127.0.0.1";

    Console.Write("¿Enviar a la impresora por Red IP? (s/n): ");
    if ((Console.ReadLine() ?? "").Trim().ToLower() == "s")
    {
        var printerClient = new ZebraPrinterClient(host);
        var (success, error) = await printerClient.SendAsync(zpl);

        if (success)
            Console.WriteLine("Etiqueta enviada correctamente.");
        else
            Console.WriteLine($"Error: {error}");
    }
    else
    {
        Console.WriteLine("Cancelado.");
    }
}
