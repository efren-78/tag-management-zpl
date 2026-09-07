using LabelPrinterMVP.Endpoints;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ── CORS: Permitir solicitudes desde el frontend ──
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ── Rate Limiting: 3 solicitudes cada 10 segundos ──
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.PermitLimit = 3;
        opt.Window = TimeSpan.FromSeconds(10);
        opt.QueueLimit = 0;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
});

var app = builder.Build();

app.UseCors();
app.UseRateLimiter();

// ── Registro modular de Endpoints ──
app.MapHealthEndpoints();
app.MapPrinterEndpoints();
app.MapZplEndpoints();

app.Run();
