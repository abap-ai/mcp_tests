"! <p class="shorttext synchronized" lang="en">Test Server for ICF based sessions</p>
CLASS zcl_mcp_test_icf_session DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.

  PROTECTED SECTION.
    METHODS handle_initialize REDEFINITION.
    METHODS handle_list_tools REDEFINITION.
    METHODS handle_call_tool  REDEFINITION.
    METHODS get_session_mode  REDEFINITION.

  PRIVATE SECTION.
    METHODS get_increment_schema
      RETURNING VALUE(result) TYPE REF TO zcl_mcp_schema_builder
      RAISING   zcx_mcp_ajson_error.

    " In ICF Session we can store data here and do not need to pass it around
    DATA curr_increment   TYPE i VALUE 0.
    DATA increment_schema TYPE REF TO zcl_mcp_schema_builder.
ENDCLASS.

CLASS zcl_mcp_test_icf_session IMPLEMENTATION.
  METHOD handle_initialize.
    response-result->set_implementation( VALUE #( name    = `Simple Test Server to check ICF sessions`
                                                  version = `1.0` ) ) ##NO_TEXT.
    response-result->set_capabilities( VALUE #( tools = abap_true ) ).
  ENDMETHOD.

  METHOD handle_list_tools.
    TRY.
        response-result->set_tools( VALUE #( ( name         = `Test ICF Session`
                                               description  = `Using ICF sessions we increment by the given number`
                                               input_schema = get_increment_schema( )->to_json( ) ) ) ) ##NO_TEXT.
      CATCH zcx_mcp_ajson_error.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = |Error creating tool definition| ##NO_TEXT.
    ENDTRY.
  ENDMETHOD.

  METHOD handle_call_tool.
    CASE request->get_name( ).
      WHEN `Test ICF Session`.
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
        curr_increment = curr_increment + increment.
        response-result->add_text_content( |Incremented value: { curr_increment }| ) ##NO_TEXT.

        " Store the new value in the session
        session->add( VALUE #( key   = `increment`
                               value = curr_increment ) ).
      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Tool { request->get_name( ) } not found.| ##NO_TEXT.
    ENDCASE.
  ENDMETHOD.

  METHOD get_session_mode.
    result = zcl_mcp_session=>session_mode_icf.
  ENDMETHOD.

  METHOD get_increment_schema.
    IF increment_schema IS BOUND.
      result = increment_schema.
      RETURN.
    ELSE.
      increment_schema = NEW zcl_mcp_schema_builder( ).
      increment_schema->add_integer( name        = `increment`
                                     description = `Increment value`
                                     required    = abap_true
                                     minimum     = 1
                                     maximum     = 1000000 ) ##NO_TEXT.
      result = increment_schema.
    ENDIF.
  ENDMETHOD.

ENDCLASS.
