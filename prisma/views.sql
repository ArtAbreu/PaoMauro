-- Overhead por unidade baseado no último período configurado
create or replace view app_overhead_view as
select
  p.id as product_id,
  case
    when cfg.units_produced > 0 then
      (cfg.gas_cost + cfg.energy_cost + cfg.water_cost + cfg.packaging_cost + cfg.other_cost) / cfg.units_produced
    else 0
  end as overhead_unit
from product p
left join lateral (
  select
    oc.gas_cost,
    oc.energy_cost,
    oc.water_cost,
    oc.packaging_cost,
    oc.other_cost,
    oc.units_produced
  from overhead_config oc
  order by oc.period_end desc
  limit 1
) cfg on true;

-- dim_date: calendário brasileiro com semana iniciando em segunda-feira
drop materialized view if exists dim_date;
create materialized view dim_date as
with recursive dates as (
  select date_trunc('day', current_date - interval '2 years')::date as d
  union all
  select d + interval '1 day'
  from dates
  where d + interval '1 day' <= current_date + interval '1 year'
)
select
  d as date,
  extract(year from d)::int as year,
  extract(month from d)::int as month,
  extract(day from d)::int as day,
  extract(week from d)::int as week_iso,
  to_char(d, 'TMMonth') as month_name,
  to_char(d, 'Day') as day_name,
  case when extract(isodow from d) in (6,7) then true else false end as is_weekend
from dates;

-- v_fct_sales
create or replace view v_fct_sales as
select
  o.id as order_id,
  o.order_date,
  o.customer_id,
  c.name as customer_name,
  i.product_id,
  p.name as product_name,
  i.qty,
  i.unit_price,
  i.total,
  o.total_discount,
  o.payment_method,
  o.status,
  (i.total - o.total_discount / greatest(nullif(array_length(array(select 1 from sales_order_item soi where soi.order_id = o.id), 1), 0),1)) as total_net_item,
  rco.cogs_ingredientes,
  rco.overhead_unit
from sales_order o
join sales_order_item i on i.order_id = o.id
join product p on p.id = i.product_id
left join customer c on c.id = o.customer_id
left join lateral (
  select
    (sum(ri.qty_per_batch::numeric * coalesce(im.avg_cost, ing.unit_cost::numeric)) / nullif(r.yield_units,0))::numeric(12,4) as cogs_ingredientes,
    coalesce(cfg.overhead_unit, 0)::numeric(12,4) as overhead_unit
  from recipe r
  join recipe_item ri on ri.recipe_id = r.id
  join ingredient ing on ing.id = ri.ingredient_id
  left join lateral (
    select avg(unit_cost::numeric) as avg_cost
    from inventory_movement
    where ingredient_id = ing.id and type = 'IN'
  ) im on true
  left join app_overhead_view cfg on cfg.product_id = p.id
  where r.product_id = p.id
  group by cfg.overhead_unit, r.yield_units
) rco on true;

-- v_fct_production
create or replace view v_fct_production as
select
  b.id,
  b.product_id,
  p.name as product_name,
  b.started_at,
  b.finished_at,
  b.planned_units,
  b.actual_units,
  (b.planned_units - coalesce(b.actual_units, 0)) as losses
from production_batch b
join product p on p.id = b.product_id;

-- v_fct_inventory
create or replace view v_fct_inventory as
with movements as (
  select
    ingredient_id,
    date_trunc('day', created_at) as day,
    sum(case when type = 'IN' then qty else 0 end) as qty_in,
    sum(case when type in ('OUT','ADJ') then qty else 0 end) as qty_out,
    avg(unit_cost) filter (where unit_cost is not null) as unit_cost
  from inventory_movement
  group by 1,2
)
select
  m.ingredient_id,
  i.name as ingredient_name,
  m.day,
  m.qty_in,
  m.qty_out,
  m.unit_cost,
  sum(coalesce(m.qty_in,0) - coalesce(m.qty_out,0)) over (partition by m.ingredient_id order by m.day rows unbounded preceding) as balance
from movements m
join ingredient i on i.id = m.ingredient_id;

-- v_fct_expenses
create or replace view v_fct_expenses as
select
  e.id,
  e.date,
  e.category,
  e.description,
  e.amount,
  e.payment_method
from expense e;

-- v_fct_cashbook
create or replace view v_fct_cashbook as
select
  c.id,
  c.date,
  c.type,
  c.amount,
  c.payment_method,
  c.description
from cashbook c;
