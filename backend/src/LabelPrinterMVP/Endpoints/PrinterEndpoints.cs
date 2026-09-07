using System.Threading.RateLimiting;
using LabelPrinterMVP.DTOs.Requests;
using LabelPrinterMVP.DTOs.Responses;
using LabelPrinterMVP.Validation;

namespace LabelPrinterMVP.Endpoints;

public static class PrinterEndpoints
{
    public static void MapPrinterEndpoints(this IEndpointRouteBuilder app)
    {
        // ── GET /api/printers ──
        app.MapGet("/api/printers", () =>
        {
            var printers = ZebraUsbPrinterClient.GetInstalledPrinters();
            return Results.Ok(new PrintersResponse(printers));
        })
        .WithName("GetPrinters")
        .WithTags("Impresoras");

        // ── POST /api/print/tcp ──
        app.MapPost("/api/print/tcp", async (TcpPrintRequest request) =>
        {
            var validation = ZplSecurityValidator.Validate(request.Zpl);
            if (!validation.IsValid)
                return Results.BadRequest(new PrintResponse(false, validation.ErrorMessage));

            if (string.IsNullOrWhiteSpace(request.Host))
                return Results.BadRequest(new PrintResponse(false, "El campo 'Host' es requerido."));

            var client = new ZebraPrinterClient(request.Host, request.Port);
            var (success, error) = await client.SendAsync(request.Zpl);

            return success
                ? Results.Ok(new PrintResponse(true, "Etiqueta enviada correctamente por TCP/IP."))
                : Results.UnprocessableEntity(new PrintResponse(false, error));
        })
        .WithName("PrintViaTcp")
        .WithTags("Impresión")
        .RequireRateLimiting("fixed");

        // ── POST /api/print/usb ──
        app.MapPost("/api/print/usb", async (UsbPrintRequest request) =>
        {
            var validation = ZplSecurityValidator.Validate(request.Zpl);
            if (!validation.IsValid)
                return Results.BadRequest(new PrintResponse(false, validation.ErrorMessage));

            if (string.IsNullOrWhiteSpace(request.PrinterName))
                return Results.BadRequest(new PrintResponse(false, "El campo 'PrinterName' es requerido."));

            var (success, error) = await ZebraUsbPrinterClient.SendAsync(request.PrinterName, request.Zpl);

            return success
                ? Results.Ok(new PrintResponse(true, "Etiqueta enviada correctamente por USB."))
                : Results.UnprocessableEntity(new PrintResponse(false, error));
        })
        .WithName("PrintViaUsb")
        .WithTags("Impresión")
        .RequireRateLimiting("fixed");
    }
}
