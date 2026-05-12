terraform {
  required_version = ">= 1.5.0"
  
  # CONEXIÓN AL BACKEND REMOTO QUE CREASTE EN EL PORTAL
  backend "azurerm" {
    resource_group_name  = "rg-terraform-mgmt"
    
    # ⚠️ REEMPLAZA ESTE VALOR: Coloca el nombre exacto de tu Storage Account del Portal
    storage_account_name = "sttfstateopticaprd"
    
    container_name       = "tfstate"
    key                  = "prd.terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }
}

provider "azurerm" {
  features {}
}

# 1. Llamada al Módulo Base (Grupo de Recursos)
module "base" {
  source   = "./modules/base"
  rg_name  = "rg-${var.prefix}-prd-001"
  location = var.location
}

# 2. Llamada al Módulo de Base de Datos
module "database" {
  source       = "./modules/database"
  account_name = "cosmos-${var.prefix}-prd-001"
  rg_name      = module.base.name
  location     = module.base.location
  
  depends_on   = [module.base]
}

# 3. Llamada al Módulo de Frontend (Static Web Apps)
module "frontend" {
  source     = "./modules/frontend"
  app_name   = "aswa-${var.prefix}-prd-001"
  rg_name    = module.base.name
  location   = module.base.location

  depends_on = [module.base]
}