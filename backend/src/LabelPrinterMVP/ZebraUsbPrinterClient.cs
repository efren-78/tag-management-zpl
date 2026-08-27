using System.Runtime.InteropServices;
using System.Text;

namespace LabelPrinterMVP;

/// <summary>
/// Clase que se conecta a la impresora mediante conexión USB (o Spooler de Windows)
/// enviando datos crudos (RAW ZPL) a través de la API winspool.drv.
/// </summary>
public class ZebraUsbPrinterClient
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName = "Etiqueta ZPL Zebra";
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType = "RAW";
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool EnumPrinters(uint flags, string? name, uint level, IntPtr pPrinterEnum, uint cbBuf, out uint pcbNeeded, out uint pcReturned);

    private const uint PRINTER_ENUM_LOCAL = 0x00000002;
    private const uint PRINTER_ENUM_CONNECTIONS = 0x00000004;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct PRINTER_INFO_4
    {
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pPrinterName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pServerName;
        public uint Attributes;
    }

    /// <summary>
    /// Devuelve una lista con los nombres de todas las impresoras instaladas en el equipo Windows.
    /// </summary>
    public static List<string> GetInstalledPrinters()
    {
        var printerNames = new List<string>();

        if (!OperatingSystem.IsWindows())
            return printerNames;

        try
        {
            uint flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            EnumPrinters(flags, null, 4, IntPtr.Zero, 0, out uint cbNeeded, out _);

            if (cbNeeded == 0)
                return printerNames;

            IntPtr pAddr = Marshal.AllocHGlobal((int)cbNeeded);
            try
            {
                if (EnumPrinters(flags, null, 4, pAddr, cbNeeded, out _, out uint count))
                {
                    int structSize = Marshal.SizeOf(typeof(PRINTER_INFO_4));
                    for (int i = 0; i < count; i++)
                    {
                        IntPtr current = new IntPtr(pAddr.ToInt64() + (i * structSize));
                        var info = Marshal.PtrToStructure<PRINTER_INFO_4>(current);
                        if (!string.IsNullOrEmpty(info.pPrinterName))
                        {
                            printerNames.Add(info.pPrinterName);
                        }
                    }
                }
            }
            finally
            {
                Marshal.FreeHGlobal(pAddr);
            }
        }
        catch
        {
            // Omitir si ocurre un fallo al listar impresoras
        }

        return printerNames;
    }

    /// <summary>
    /// Envía un string ZPL a una impresora de Windows instalada (USB) por su nombre.
    /// </summary>
    public static Task<(bool Success, string? Error)> SendAsync(string printerName, string zpl)
    {
        return Task.Run(() => Send(printerName, zpl));
    }

    public static (bool Success, string? Error) Send(string printerName, string zpl)
    {
        if (!OperatingSystem.IsWindows())
        {
            return (false, "La impresión directa por USB / Spooler de Windows solo está disponible en Windows.");
        }

        IntPtr hPrinter = IntPtr.Zero;
        var di = new DOCINFOA();

        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {
                int err = Marshal.GetLastWin32Error();
                return (false, $"No se pudo abrir la impresora '{printerName}'. Código Win32: {err}");
            }

            if (!StartDocPrinter(hPrinter, 1, di))
            {
                int err = Marshal.GetLastWin32Error();
                ClosePrinter(hPrinter);
                return (false, $"Error al iniciar el trabajo de impresión en '{printerName}'. Código: {err}");
            }

            if (!StartPagePrinter(hPrinter))
            {
                int err = Marshal.GetLastWin32Error();
                EndDocPrinter(hPrinter);
                ClosePrinter(hPrinter);
                return (false, $"Error al iniciar la página en '{printerName}'. Código: {err}");
            }

            byte[] bytes = Encoding.UTF8.GetBytes(zpl);
            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

            bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out int written);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);

            if (!success || written != bytes.Length)
            {
                int err = Marshal.GetLastWin32Error();
                return (false, $"Error al enviar los datos RAW a '{printerName}'. Bytes enviados: {written}/{bytes.Length}. Error: {err}");
            }

            return (true, null);
        }
        catch (Exception ex)
        {
            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
            return (false, $"Error inesperado al enviar a impresora USB: {ex.Message}");
        }
    }
}
