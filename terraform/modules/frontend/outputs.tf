output "api_key" { 
  value     = azurerm_static_web_app.aswa.api_key 
  sensitive = true
}
output "default_hostname" { value = azurerm_static_web_app.aswa.default_host_name }