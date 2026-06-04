from pydantic import BaseModel
from typing import Optional, List
class ReportRequest(BaseModel):
    financialYear: str


class CategorizedTransaction(BaseModel):
    transactionId: str
    category: str
    subcategory: str
    taxDeductible: bool
    vatApplicable: bool
    note: str
    
    
class TaxSummary(BaseModel):
    totalIncome: float
    totalBusinessExpenses: float
    totalPersonalExpenses: float
    netTaxableIncome: float
    annualTurnoverEstimate: float
    citRate: str
    citOwed: float
    vatApplicable: bool
    vatNote: str
    filingDeadline: str
    recommendation: str
    
class ReportResponse(BaseModel):
    success: bool
    data: dict