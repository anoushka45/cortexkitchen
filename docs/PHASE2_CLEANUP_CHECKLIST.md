# Phase 2 - Cleanup & Next Steps Checklist

## Debug Logging Cleanup

These debug statements were added during troubleshooting and should be removed before merging to main:

### 1. `apps/api/app/domain/services/inventory_service.py`
```python
# REMOVE THIS:
print(f"[DEBUG] Inventory query returned {len(items)} items")
```
**Location:** In `get_all_stock()` method  
**Reason:** Development debugging only

---

### 2. `apps/api/app/orchestration/nodes/inventory.py`
```python
# REMOVE THESE debug statements
print(f"[DEBUG] Using simulated inventory for {target_date}")
print(f"[DEBUG] Simulation mode active")
```
**Location:** In inventory node invoke method  
**Reason:** Development debugging only

---

### 3. `apps/api/app/api/dependencies.py`
```python
# REMOVE THIS:
print(f"[DEBUG] Session created with connection string: {connection_string}")
```
**Location:** In `get_db()` function  
**Reason:** Development debugging only + security concern (exposes credentials)

---

### 4. `apps/web/cortexkitchen-ui/components/dashboard/ReservationSummary.tsx`
```typescript
// REMOVE THESE console logs:
console.log("[ReservationSummary] Full data:", data);
console.log("[ReservationSummary] dataObj:", dataObj);
console.log("[ReservationSummary] recommendation:", recommendation);
```
**Location:** In `ReservationSummary` component  
**Reason:** Development debugging only

---

## Cleanup Checklist

- [ ] Remove all debug logging statements listed above
- [ ] Run full test suite: `pytest tests/ -v`
- [ ] Test frontend on actual API: Browse to http://localhost:3000
- [ ] Verify metrics display correctly for April 24
- [ ] Verify no console errors in browser dev tools
- [ ] Test with different dates (This Friday, Next Friday, custom)
- [ ] Test with empty inventory scenario (if exists)
- [ ] Verify API response structure is consistent

---

## Code Quality Checks

- [ ] Run linter on modified Python files
- [ ] Run eslint on modified TypeScript/React files
- [ ] Check for unused imports
- [ ] Verify type safety (no `any` type leaks)
- [ ] Add docstrings to new functions

---

## Testing Requirements Before Merge

### Unit Tests
- [ ] `test_reservation_summary.tsx` - Component rendering with different data
- [ ] `test_final_assembler.py` - Data preservation logic
- [ ] `test_date_picker.tsx` - Timezone handling

### Integration Tests
- [ ] End-to-end Friday rush planning flow
- [ ] Verify all 12 inventory items appear
- [ ] Verify all agents execute and return data
- [ ] Verify recommendation text renders properly

### Manual Testing
- [ ] Test in Firefox (date formatting)
- [ ] Test in Safari (timezone handling)
- [ ] Test on different Windows versions
- [ ] Test with slow network (verify loading states)

---

## Files to Review Before Merge

1. **ReservationSummary.tsx** - New component, needs design review
2. **final_assembler.py** - Logic change to data preservation
3. **DatePicker.tsx** - Timezone fix validation
4. **AgentCard.tsx** - Component routing logic

---

## Code Review Checklist

- [ ] All changes follow project coding standards
- [ ] No hardcoded values (all should be configurable)
- [ ] Error handling is comprehensive
- [ ] No breaking changes to existing APIs
- [ ] Documentation is updated (✅ DONE in PHASE2_INVENTORY_ALERTS_SUMMARY.md)
- [ ] All tests passing

---

## Deployment Checklist

### Pre-Production
- [ ] Database migration verified (if any)
- [ ] Environment variables documented
- [ ] .env file reviewed for security
- [ ] API response payload size acceptable

### Production
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Performance baselines established
- [ ] User feedback collection plan

---

## Outstanding Issues (If Any)

**None identified at time of documentation**

All major issues have been resolved:
- ✅ Date selection bug fixed
- ✅ Inventory data restored
- ✅ Recommendation rendering fixed
- ✅ Metrics display working

---

## Next Phase (Phase 3) Planning

### Potential Features
1. **Inventory Alerts System**
   - Low stock warnings
   - Expiration date alerts
   - Ordering automation

2. **Historical Analytics**
   - Reservation trends
   - Demand forecasting
   - Occupancy patterns

3. **Recommendation Engine Enhancement**
   - ML-based predictions
   - Personalized suggestions
   - A/B testing framework

4. **Notification System**
   - Email alerts
   - Slack integration
   - Dashboard notifications

---

## Branch Information

**Current Branch:** `feature/phase2-inventory-alerts`  
**Base Branch:** `main`  
**Created:** During Phase 2 development  

### Branch Ready to Merge: ✅ YES (after cleanup)

---

## Questions & Notes

- Consider adding time-based cache for inventory queries
- Evaluate need for real-time inventory sync
- Plan for multi-restaurant support in Phase 3
- Consider mobile app requirements

