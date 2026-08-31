using LabelPrinterMVP.DTOs.Requests;
using LabelPrinterMVP.DTOs.Responses;

namespace LabelPrinterMVP.Endpoints;

public static class ZplEndpoints
{
    public static void MapZplEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/zpl")
                       .WithTags("ZPL");

        // ── POST /api/zpl/build ──
        group.MapPost("/build", (BuildLabelRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.ProductName))
                return Results.BadRequest(new PrintResponse(false, "El campo 'ProductName' es requerido."));

            if (string.IsNullOrWhiteSpace(request.Code))
                return Results.BadRequest(new PrintResponse(false, "El campo 'Code' es requerido."));

            var data = new LabelData
            {
                ProductName = request.ProductName,
                Code = request.Code,
                Copies = request.Copies > 0 ? request.Copies : 1,
                Date = DateTime.Now
            };

            var zpl = ZplBuilder.BuildLabel(data, request.WidthInches, request.HeightInches);

            return Results.Ok(new PrintResponse(true, "ZPL generado exitosamente.", zpl));
        })
        .WithName("BuildZpl");
    }
}
