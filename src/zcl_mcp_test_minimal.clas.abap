CLASS zcl_mcp_test_minimal DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.

  PROTECTED SECTION.
    METHODS: handle_initialize REDEFINITION.
    METHODS: get_session_mode REDEFINITION.
  PRIVATE SECTION.
ENDCLASS.



CLASS zcl_mcp_test_minimal IMPLEMENTATION.
  METHOD handle_initialize.
    response-result->set_implementation( VALUE #( name    = `Simple Test Server with no features`
                                                  version = `1.0` ) ) ##NO_TEXT.
  ENDMETHOD.

  METHOD get_session_mode.
    result = zcl_mcp_session=>session_mode_stateless.
  ENDMETHOD.

ENDCLASS.
