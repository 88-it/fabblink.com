#include <eosio.token/eosio.token.hpp>
#include <fabblink.hub/fabblink.hub.hpp>
#include <fabblink.hub/config.hpp>

namespace fabblink {

void hub::regdesignr(eosio::name designer) {
    eosio::require_auth(designer);

    auto designers = designer_table(_self, designer.value);
    auto itr = designers.find(designer_info::primary_key());
    eosio::check(designers.end() == itr, "Designer already exists");

    designers.emplace(designer, [&](auto& itm){});
}

void hub::unregdesignr(eosio::name designer) {
    eosio::require_auth(designer);

    auto designers = designer_table(_self, designer.value);
    auto itr = designers.find(designer_info::primary_key());
    eosio::check(designers.end() != itr, "Designer doesn't exist");

    designers.erase(itr);
}

void hub::regdesign(
    eosio::name designer,
    eosio::checksum256 design,
    eosio::asset price,
    eosio::asset fee
) {
    eosio::require_auth(designer);

    eosio::check(price.symbol == config::symbol, "Wrong price asset");
    eosio::check(price.symbol == fee.symbol, "Wrong fee asset");
    eosio::check(price.amount > 0, "Price amount should be more than zero");
    eosio::check(fee.amount >= 0, "Fee amount should be zero or more");

    auto designers = designer_table(_self, designer.value);
    eosio::check(designers.end() != designers.find(designer_info::primary_key()), "Designer doesn't exist");

    auto designs = design_table(_self, _self.value);
    auto hash_idx = designs.get_index<"byhash"_n>();
    auto itr = hash_idx.find(design);
    if (hash_idx.end() != itr) {
        eosio::check(itr->designer == designer, "Designer can't be changed");
        eosio::check(itr->price != price || itr->fee != fee, "Price/fee doesn't change");

        hash_idx.modify(itr, eosio::same_payer, [&](auto& itm){
            itm.price = price;
            itm.fee = fee;
        });
    } else {
        designs.emplace(designer, [&](auto& itm){
            itm.id = designs.available_primary_key();
            itm.hash = design;
            itm.designer = designer;
            itm.price = price;
            itm.fee = fee;
        });
    }
}

void hub::unregdesign(
    eosio::name designer,
    eosio::checksum256 design
) {
    eosio::require_auth(designer);

    auto designs = design_table(_self, _self.value);
    auto hash_idx = designs.get_index<"byhash"_n>();
    auto itr = hash_idx.find(design);
    eosio::check(hash_idx.end() != itr, "Design doesn't exist");
    eosio::check(itr->designer == designer, "Design can be deleted only by designer");

    hash_idx.erase(itr);
}

void hub::regvendor(eosio::name vendor) {
    eosio::require_auth(vendor);

    auto vendors = vendor_table(_self, vendor.value);
    auto itr = vendors.find(vendor_info::primary_key());
    eosio::check(vendors.end() == itr, "Vendor already exists");

    vendors.emplace(vendor, [&](auto& itm){});
}

void hub::unregvendor(eosio::name vendor) {
    eosio::require_auth(vendor);

    auto vendors = vendor_table(_self, vendor.value);
    auto itr = vendors.find(vendor_info::primary_key());
    eosio::check(vendors.end() != itr, "Vendor doesn't exist");

    vendors.erase(itr);
}

void hub::printorder(
    eosio::name vendor,
    eosio::name order
) {
    eosio::require_auth(vendor);

    auto orders = order_table(_self, vendor.value);
    auto itr = orders.find(order.value);
    eosio::check(orders.end() != itr, "Order doesn't exist");
    eosio::check(itr->printed_quantity < itr->requested_quantity, "There are no more designs to print");

    orders.modify(itr, eosio::same_payer, [&](auto& itm){
        itm.printed_quantity++;
    });
}

void hub::placeorder(
    eosio::name consumer,
    eosio::name vendor,
    eosio::name order,
    eosio::checksum256 design,
    uint16_t quantity
) {
    eosio::require_auth(consumer);

    eosio::check(quantity > 0, "Quantity of designs should be more than zero");
    eosio::check(quantity <= 1000, "Quantity of designs shoube less than 1001");

    auto orders = order_table(_self, vendor.value);
    auto itr = orders.find(order.value);
    eosio::check(orders.end() == itr, "Order with such name already exists");

    auto consumers = consumer_table(_self, consumer.value);
    auto ctr = consumers.find(consumer_info::primary_key());
    eosio::check(consumers.end() != ctr, "Consumer doesn't have balance");

    auto designs = design_table(_self, _self.value);
    auto hash_idx = designs.get_index<"byhash"_n>();
    auto dtr = hash_idx.find(design);
    eosio::check(hash_idx.end() != dtr, "Design doesn't exist");

    auto vendor_income = dtr->price * quantity;
    auto designer_income = dtr->fee * quantity;
    auto total_price = vendor_income + designer_income;
    eosio::check(total_price <= ctr->balance, "Not enough tokens to pay on order");

    auto vendors = vendor_table(_self, vendor.value);
    auto vtr = vendors.find(vendor_info::primary_key());
    eosio::check(vendors.end() != vtr, "Vendor doesn't exist");

    auto designers = designer_table(_self, dtr->designer.value);
    auto etr = designers.find(designer_info::primary_key());
    eosio::check(designers.end() != etr, "Designer doesn't exist");

    orders.emplace(consumer, [&](auto& itm){
        itm.order = order;
        itm.designer = dtr->designer;
        itm.consumer = consumer;
        itm.requested_quantity = quantity;
        itm.printed_quantity = 0;
        itm.designer_income = designer_income;
        itm.vendor_income = vendor_income;
    });

    if (total_price == ctr->balance) {
        consumers.erase(ctr);
    } else {
        consumers.modify(ctr, eosio::same_payer, [&](auto& itm) {
            itm.balance -= total_price;
        });
    }
}

void hub::cancelorder(
    eosio::name consumer,
    eosio::name vendor,
    eosio::name order
) {
    eosio::require_auth(consumer);

    auto orders = order_table(_self, vendor.value);
    auto itr = orders.find(order.value);
    eosio::check(orders.end() != itr, "Order doesn't exist");
    eosio::check(!itr->printed_quantity, "Order has printed designs");
    eosio::check(itr->consumer == consumer, "Order was placed by other consumer");

    auto consumers = consumer_table(_self, consumer.value);
    auto ctr = consumers.find(consumer_info::primary_key());

    auto total_price = itr->designer_income + itr->vendor_income;

    if (consumers.end() != ctr) {
        consumers.modify(ctr, eosio::same_payer, [&](auto& itm){
            itm.balance += total_price;
        });
    } else {
        consumers.emplace(_self, [&](auto& itm){
            itm.balance = total_price;
        });
    }

    orders.erase(itr);
}

void hub::confirmorder(
    eosio::name consumer,
    eosio::name vendor,
    eosio::name name
) {
    eosio::require_auth(consumer);

    auto orders = order_table(_self, vendor.value);
    auto itr = orders.find(name.value);
    eosio::check(orders.end() != itr, "Order doesn't exist");
    eosio::check(itr->printed_quantity == itr->requested_quantity, "Not all designs printed");

    if (itr->designer_income.amount > 0) {
        eosio::token::transfer_action{"eosio.token"_n, {_self, "code"_n}}.send(
            _self, itr->designer, itr->designer_income, "");
    }

    if (itr->vendor_income.amount > 0) {
        eosio::token::transfer_action{"eosio.token"_n, {_self, "code"_n}}.send(
            _self, vendor, itr->vendor_income, "");
    }

    orders.erase(itr);
}

void hub::on_transfer(
    eosio::name from,
    eosio::name to,
    eosio::asset value,
    std::string memo
) {
    if (to != _self || from == _self) {
        return;
    }

    eosio::check(value.symbol == config::symbol, "Wrong value asset");
    eosio::check(value.amount >= config::min_balance_replenishment, "Value less than required");

    auto consumers = consumer_table(_self, from.value);
    auto itr = consumers.find(consumer_info::primary_key());

    if (consumers.end() != itr) {
        consumers.modify(itr, eosio::same_payer, [&](auto& itm) {
           itm.balance += value;
        });
    } else {
        consumers.emplace(_self, [&](auto& itm){
           itm.balance = value;
        });
    }
}

} /// namespace fabblink