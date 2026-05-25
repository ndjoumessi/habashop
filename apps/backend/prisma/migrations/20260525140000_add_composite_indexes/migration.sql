-- CreateIndex
CREATE INDEX "PlanRequest_tenantId_status_idx" ON "PlanRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Product_tenantId_barcode_idx" ON "Product"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "Sale_tenantId_paymentMode_idx" ON "Sale"("tenantId", "paymentMode");

-- CreateIndex
CREATE INDEX "Customer_tenantId_totalRevenue_idx" ON "Customer"("tenantId", "totalRevenue");

-- CreateIndex
CREATE INDEX "Customer_tenantId_type_idx" ON "Customer"("tenantId", "type");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_createdAt_idx" ON "PurchaseOrder"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Employee_tenantId_dept_idx" ON "Employee"("tenantId", "dept");

-- CreateIndex
CREATE INDEX "Employee_tenantId_isActive_idx" ON "Employee"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");
