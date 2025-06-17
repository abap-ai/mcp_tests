"! <p class="shorttext synchronized" lang="en">Test Server for MCP based sessions</p>
CLASS zcl_mcp_test_mcp_session DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.

  PROTECTED SECTION.
    METHODS handle_initialize REDEFINITION.
    METHODS handle_list_tools REDEFINITION.
    METHODS handle_call_tool  REDEFINITION.
    METHODS: get_session_mode REDEFINITION.

  PRIVATE SECTION.
    METHODS get_increment_schema
      RETURNING VALUE(result) TYPE REF TO zcl_mcp_schema_builder
      RAISING   zcx_mcp_ajson_error.
ENDCLASS.



CLASS zcl_mcp_test_mcp_session IMPLEMENTATION.
  METHOD handle_initialize.
    response-result->set_implementation( VALUE #( name    = `Simple Test Server to check MCP sessions`
                                                  version = `1.0` ) ) ##NO_TEXT.
    response-result->set_capabilities( VALUE #( tools = abap_true ) ).
  ENDMETHOD.

  METHOD handle_list_tools.
    TRY.
        response-result->set_tools( VALUE #( ( name         = `Test MCP Session`
                                               description  = `Using MCP sessions we increment by the given number`
                                               input_schema = get_increment_schema( )->to_json( ) ) ) ) ##NO_TEXT.
      CATCH zcx_mcp_ajson_error.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = |Error creating tool definition| ##NO_TEXT.
    ENDTRY.
  ENDMETHOD.

  METHOD handle_call_tool.
    CASE request->get_name( ).
      WHEN `Test MCP Session`.
        DATA(input) = request->get_arguments( ).

        " Validate input parameter via schema validator class
        TRY.
            DATA(schema) = get_increment_schema( ).
            DATA(validator) = NEW zcl_mcp_schema_validator( schema->to_json( ) ).
            DATA(validation_result) = validator->validate( input ).
            IF validation_result = abap_false.
              response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
              response-error-message = concat_lines_of( validator->get_errors( ) ).
              RETURN.
            ENDIF.
          CATCH zcx_mcp_ajson_error INTO DATA(error).
            response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
            response-error-message = error->get_text( ).
            RETURN.
        ENDTRY.

        DATA(increment) = input->get_integer( `increment` ).

        " Get the last increment value from the session
        DATA(session_increment) = session->get( `increment` ).
        DATA current_increment TYPE i.
        IF session_increment IS INITIAL.
          " No value in the session, set it to 0
          current_increment = 0.
        ELSE.
          current_increment = session_increment-value.
        ENDIF.
        current_increment = current_increment + increment.
        response-result->add_text_content( |Incremented value: { current_increment }| ) ##NO_TEXT.

        " Store the new value in the session
        session->add( VALUE #( key   = `increment`
                               value = current_increment ) ).
      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Tool { request->get_name( ) } not found.| ##NO_TEXT.
    ENDCASE.
  ENDMETHOD.

  METHOD get_session_mode.
    result = zcl_mcp_session=>session_mode_mcp.
  ENDMETHOD.

  METHOD get_increment_schema.
    result = NEW zcl_mcp_schema_builder( ).
    result->add_integer( name        = `increment`
                         description = `Increment value`
                         required    = abap_true
                         minimum     = 1
                         maximum     = 1000000 ) ##NO_TEXT.
  ENDMETHOD.

ENDCLASS.
