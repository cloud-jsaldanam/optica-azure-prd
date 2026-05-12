resource "azurerm_static_web_app" "aswa" {
  name                = var.app_name
  resource_group_name = var.rg_name
  location            = var.location
  
  # PLAN GRATUITO PERMANENTE ($0.00 USD/mes)
  sku_tier            = "Free"
  sku_size            = "Free"
}