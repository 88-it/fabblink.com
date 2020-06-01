#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace fabblink {

class [[eosio::contract("fabblink.hub")]] hub : public eosio::contract {
public:
    using contract::contract;

    // Designer actions

    [[eosio::action]]
    void regdesignr(eosio::name designer);

    [[eosio::action]]
    void unregdesignr(eosio::name designer);

    [[eosio::action]]
    void regdesign(
        eosio::name designer, eosio::checksum256 design,
        eosio::asset price, eosio::asset fee);

    [[eosio::action]]
    void unregdesign(eosio::name designer, eosio::checksum256 design);

    // Vendor actions

    [[eosio::action]]
    void regvendor(eosio::name vendor);

    [[eosio::action]]
    void unregvendor(eosio::name vendor);

    [[eosio::action]]
    void printorder(
        eosio::name vendor, eosio::name order);

    // Consumer actions

    [[eosio::action]]
    void placeorder(
        eosio::name consumer, eosio::name vendor, eosio::name order,
        eosio::checksum256 design, uint16_t quantity);

    [[eosio::action]]
    void cancelorder(
        eosio::name consumer, eosio::name vendor, eosio::name order);

    [[eosio::action]]
    void confirmorder(
        eosio::name consumer, eosio::name vendor, eosio::name order);

    [[eosio::on_notify("eosio.token::transfer")]]
    void on_transfer(eosio::name from, eosio::name to, eosio::asset value, std::string memo);

private:
    struct [[eosio::table]] designer_info {
        // scope: designer name
        static inline uint64_t primary_key() { return 0; }
    };

    using designer_table = eosio::multi_index< "designer"_n, designer_info >;


    struct [[eosio::table]] design_info {
        // scope: contract to unique design hash
        uint64_t id;
        eosio::checksum256 hash;
        eosio::name designer;
        eosio::asset price;
        eosio::asset fee;

        uint64_t primary_key() const {
            return id;
        }

        const eosio::checksum256& hash_key() const {
            return hash;
        }
    };

    using design_table = eosio::multi_index< "design"_n, design_info,
        eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<design_info, const eosio::checksum256&, &design_info::hash_key>>>;


    struct [[eosio::table]] vendor_info {
        // scope: vendor
        static inline uint64_t primary_key() { return 0; }
    };

    using vendor_table = eosio::multi_index< "vendor"_n, vendor_info >;


    struct [[eosio::table]] consumer_info {
        // scope: consumer
        eosio::asset balance;

        static inline uint64_t primary_key() { return 0; }
    };

    using consumer_table = eosio::multi_index< "consumer"_n, consumer_info >;


    struct [[eosio::table]] order_info {
        // scope: vendor
        eosio::name order;

        eosio::name designer;

        eosio::name consumer;
        uint16_t requested_quantity = 0;
        uint16_t printed_quantity = 0;

        eosio::asset vendor_income;
        eosio::asset designer_income;

        uint64_t primary_key() const {
            return order.value;
        }
    };

    using order_table = eosio::multi_index< "order"_n, order_info>;
};

} /// namespace fabblink