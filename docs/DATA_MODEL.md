# Data Model
# CortexKitchen

## 1. Purpose

This document defines the planned core data model for CortexKitchen.

The project uses:
- PostgreSQL for structured operational data
- Qdrant for vector memory
- Redis for short-term cache/state

The data model is designed for a pizza-focused restaurant and the flagship Friday Night Rush Optimization scenario.

---

## 2. PostgreSQL Data Domains

The main structured data domains are:
- reservations
- orders
- order items
- menu items
- ingredients
- inventory
- complaints/reviews metadata
- decision traces
- critic evaluations

---

## 3. Core Tables

## 3.1 restaurants
Stores restaurant-level context.

### Fields
- id
- name
- cuisine_type
- timezone
- created_at
- updated_at

### Notes
Initially, the project may operate as a single-restaurant simulation, but this table keeps the model expandable.

---

## 3.2 table_capacity_config
Defines reservation and seating limits.

### Fields
- id
- restaurant_id
- total_seats
- max_reservations_per_slot
- slot_duration_minutes
- created_at
- updated_at

### Notes
Used by the Reservation Agent and Critic Agent.

---

## 3.3 reservations
Stores reservation records.

### Fields
- id
- restaurant_id
- source
- customer_name
- party_size
- reservation_date
- reservation_time
- slot_label
- status
- notes
- created_at
- updated_at

### Example source values
- walk_in
- phone
- zomato_simulated
- dineout_simulated
- website

### Example status values
- confirmed
- cancelled
- waitlisted
- completed

---

## 3.4 orders
Stores order-level information.

### Fields
- id
- restaurant_id
- order_datetime
- order_channel
- order_type
- total_amount
- status
- created_at

### Example order_channel values
- dine_in
- takeaway
- delivery

### Example order_type values
- regular
- rush
- promo

---

## 3.5 order_items
Stores line items for each order.

### Fields
- id
- order_id
- menu_item_id
- quantity
- unit_price
- line_total
- created_at

### Notes
Supports menu analytics and demand forecasting features.

---

## 3.6 menu_items
Stores menu catalog entries.

### Fields
- id
- restaurant_id
- item_name
- category
- is_pizza
- price
- estimated_cost
- is_active
- created_at
- updated_at

### Example categories
- pizza
- beverage
- appetizer
- dessert

---

## 3.7 ingredients
Stores ingredient definitions.

### Fields
- id
- restaurant_id
- ingredient_name
- unit
- reorder_threshold
- shelf_life_days
- created_at
- updated_at

### Notes
Supports inventory and spoilage awareness.

---

## 3.8 inventory_levels
Stores current stock levels.

### Fields
- id
- restaurant_id
- ingredient_id
- quantity_on_hand
- last_updated_at
- expiry_date
- batch_notes

### Notes
Supports shortage and overstock detection.

---

## 3.9 menu_item_ingredients
Maps menu items to ingredients.

### Fields
- id
- menu_item_id
- ingredient_id
- quantity_required

### Notes
Important later for connecting demand forecasts to ingredient usage.

---

## 3.10 complaints
Stores complaint or review metadata.

### Fields
- id
- restaurant_id
- platform
- rating
- complaint_date
- complaint_text
- complaint_type
- sentiment_label
- is_resolved
- created_at

### Example platform values
- google_simulated
- zomato_simulated
- dineout_simulated
- internal_feedback

### Example complaint_type values
- slow_service
- pizza_delay
- cold_food
- wrong_order
- rude_staff
- general

### Notes
The text may also be embedded and stored in Qdrant.

---

## 3.11 decision_traces
Stores the outcome of system decisions.

### Fields
- id
- restaurant_id
- scenario_type
- request_timestamp
- participating_agents
- structured_inputs_json
- retrieved_context_summary
- proposed_actions_json
- final_output_json
- critic_status
- critic_score
- created_at

### Notes
A core enterprise-style table for explainability and demos.

---

## 3.12 critic_evaluations
Stores critic-specific review data.

### Fields
- id
- decision_trace_id
- validation_status
- violations_json
- revision_notes
- score
- created_at

### Notes
Can either stay separate or be partially duplicated in decision traces depending on implementation simplicity.

---

## 4. Relationships (Conceptual)

### Key relationships
- one restaurant has many reservations
- one restaurant has many orders
- one order has many order_items
- one restaurant has many menu_items
- many menu_items use many ingredients through menu_item_ingredients
- one restaurant has many complaints
- one restaurant has many decision_traces
- one decision_trace may have one critic_evaluation

---

## 5. Qdrant Collections

Qdrant is used for vector memory and retrieval.

## 5.1 complaints_memory
Stores embedded complaint texts.

### Metadata examples
- restaurant_id
- complaint_id
- platform
- complaint_type
- date
- rating
- tags

### Use cases
- retrieve similar past complaints
- identify recurring operational issues

---

## 5.2 sop_memory
Stores operational SOPs and guidance.

### Metadata examples
- restaurant_id
- category
- title
- applicable_area
- tags

### Use cases
- retrieve rules related to kitchen operations
- support evidence-backed recommendations
- help critic validate actions

---

## 5.3 decision_memory
Stores embedded summaries of past decisions.

### Metadata examples
- restaurant_id
- decision_trace_id
- scenario_type
- date
- tags
- critic_status

### Use cases
- retrieve similar past decisions
- support future memory-aware planning

---

## 6. Redis Usage Model

Redis will not be a primary source of truth.

### Planned uses
- cache forecast results
- cache complaint summaries
- temporary orchestration state
- future job coordination

### Important note
If Redis is cleared, the system should still function correctly.

---

## 7. Seed Data Strategy

The project will rely on synthetic seed data initially.

### Seed datasets planned
- reservations across multiple channels
- orders with strong Friday evening patterns
- pizza-heavy menu
- ingredient stock levels
- complaints/reviews with repeated complaint themes

### Why seed data matters
Strong seed data will make the demo believable and improve forecasting and complaint intelligence quality.

---

## 8. Future Data Expansion

The model is designed so future sources can be added:
- Google Reviews
- Zomato-style reservation feeds
- POS-style sales ingestion
- staffing tables
- supplier purchase orders

These are not needed for MVP but are supported conceptually.

---

## 9. Summary

CortexKitchen’s data model uses PostgreSQL for structured operational records, Qdrant for vector memory, and Redis for short-term state/caching. The schema is designed to support realistic restaurant operations while remaining manageable for a solo-built capstone.