using System.Net.Sockets;
using System.Text;

namespace LabelPrinterMVP;
/// <summary>
/// Clase que se conecta a la impresora mediante conexcion TCP/IP.
/// </summary>
public class ZebraPrinterClient
{
    private readonly string _host;
    private readonly int _port;
    private readonly int _timeoutMs;

    public ZebraPrinterClient(string host, int port = 9100, int timeoutMs = 3000)
    {
        _host = host;
        _port = port;
        _timeoutMs = timeoutMs;
    }

    /// <summary>
    /// Envía el ZPL crudo a la impresora (o al simulador) por socket TCP.
    /// Devuelve (true, null) si se envió, o (false, mensaje) si algo falló.
    /// </summary>
    public async Task<(bool Success, string? Error)> SendAsync(string zpl)
    {
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(_host, _port);
            var timeoutTask = Task.Delay(_timeoutMs);

            var completed = await Task.WhenAny(connectTask, timeoutTask);
            if (completed == timeoutTask)
                return (false, $"Timeout al conectar con {_host}:{_port}");

            using var stream = client.GetStream();
            var bytes = Encoding.ASCII.GetBytes(zpl);
            await stream.WriteAsync(bytes);

            return (true, null);
        }
        catch (SocketException ex)
        {
            return (false, $"No se pudo conectar a la impresora ({_host}:{_port}): {ex.Message}");
        }
        catch (Exception ex)
        {
            return (false, $"Error inesperado al imprimir: {ex.Message}");
        }
    }
}
