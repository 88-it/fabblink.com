#pragma once

#include <eosio/symbol.hpp>

namespace fabblink {
    namespace config {
        static const auto symbol = eosio::symbol("EOS", 4);
        static const int64_t min_balance_replenishment = 1000; // 1.000 EOS
    }
} /// namespace fabblink