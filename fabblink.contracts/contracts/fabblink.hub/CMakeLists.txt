add_contract(fabblink.hub fabblink.hub ${CMAKE_CURRENT_SOURCE_DIR}/src/fabblink.hub.cpp)

set(CMAKE_VERBOSE_MAKEFILE On)

target_include_directories(fabblink.hub
    PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include)

message("Token: ${EOSIO_CONTRACTS}/contracts/eosio.token/include")

target_include_directories(fabblink.hub
    PRIVATE
    ${EOSIO_CONTRACTS}/contracts/eosio.token/include)

set_target_properties(fabblink.hub
    PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")

# configure_file( ${CMAKE_CURRENT_SOURCE_DIR}/ricardian/fabblink.hub.contracts.md.in ${CMAKE_CURRENT_BINARY_DIR}/ricardian/fabblink.hub.contracts.md @ONLY )
# target_compile_options( fabblink.hub PUBLIC -R${CMAKE_CURRENT_SOURCE_DIR}/ricardian -R${CMAKE_CURRENT_BINARY_DIR}/ricardian )
