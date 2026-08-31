using LabelPrinterMVP.DTOs.Responses;

namespace LabelPrinterMVP.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/health")
                       .WithTags("Sistema");

        group.MapGet("/", () => Results.Ok(new HealthResponse("ok", DateTime.UtcNow)))
             .WithName("HealthCheck");
    }
}
