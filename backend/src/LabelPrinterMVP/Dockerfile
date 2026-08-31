# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Stage 2: Copy the csproj file and restore
COPY "LabelPrinterMVP.csproj" .
RUN dotnet restore

# Stage 3: Copy the rest of the source code and build
COPY "." .
RUN dotnet build -c Release

# Stage 4: Publish
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
CMD ["dotnet", "LabelPrinterMVP.dll"]