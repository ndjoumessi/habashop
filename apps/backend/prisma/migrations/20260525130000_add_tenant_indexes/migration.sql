-- CreateIndex
CREATE INDEX "PlanRequest_tenantId_idx" ON "PlanRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PlanRequest_status_idx" ON "PlanRequest"("status");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_isActive_idx" ON "Product"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Sale_tenantId_idx" ON "Sale"("tenantId");

-- CreateIndex
CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeBonus_tenantId_idx" ON "EmployeeBonus"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeBonus_employeeId_idx" ON "EmployeeBonus"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryHistory_tenantId_idx" ON "SalaryHistory"("tenantId");

-- CreateIndex
CREATE INDEX "SalaryHistory_employeeId_idx" ON "SalaryHistory"("employeeId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

