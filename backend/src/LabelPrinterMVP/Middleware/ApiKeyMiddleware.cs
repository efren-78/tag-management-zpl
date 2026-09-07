namespace LabelPrinterMVP.Middleware;

public class ApiKeyMiddleware
{
    private readonly RequestDelegate _next;
    private const string ApiKeyHeaderName = "X-Api-Key";

    public ApiKeyMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IConfiguration configuration)
    {
        // 1. Omitir verificación para preflight CORS (OPTIONS)
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        // 2. Rutas públicas excluidas de autenticación (ej: health check)
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        if (path.StartsWith("/api/health"))
        {
            await _next(context);
            return;
        }

        // 3. Obtener la clave esperada desde la configuración
        var expectedApiKey = configuration.GetValue<string>("Authentication:ApiKey");

        // Si no hay clave configurada en appsettings o variables de entorno, permitir el paso (modo desarrollo abierto)
        if (string.IsNullOrWhiteSpace(expectedApiKey))
        {
            await _next(context);
            return;
        }

        // 4. Validar que la petición incluya el header X-Api-Key
        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = "No autorizado. Falta el encabezado 'X-Api-Key'."
            });
            return;
        }

        // 5. Validar que la clave enviada coincida exactamente
        if (!string.Equals(expectedApiKey, extractedApiKey))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = "Acceso denegado. La API Key proporcionada es inválida."
            });
            return;
        }

        // 6. Clave válida, continuar con la ejecución del endpoint
        await _next(context);
    }
}
