"! <p class="shorttext synchronized" lang="en">Full Test Server</p>
CLASS zcl_mcp_test_full DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.

  PROTECTED SECTION.
    METHODS handle_initialize           REDEFINITION.
    METHODS handle_list_prompts         REDEFINITION.
    METHODS handle_get_prompt           REDEFINITION.
    METHODS handle_list_resources       REDEFINITION.
    METHODS handle_resources_read       REDEFINITION.
    METHODS handle_list_res_tmpls       REDEFINITION.
    METHODS handle_list_tools           REDEFINITION.
    METHODS handle_call_tool            REDEFINITION.
    METHODS handle_cancel_task          REDEFINITION.
    METHODS handle_completions_complete REDEFINITION.
    METHODS get_session_mode            REDEFINITION.

  PRIVATE SECTION.
    METHODS get_gif RETURNING VALUE(result) TYPE string.

    METHODS get_input_schema RETURNING VALUE(result) TYPE REF TO zcl_mcp_schema_builder
                             RAISING   zcx_mcp_ajson_error.

    METHODS get_async_task_schema
      RETURNING VALUE(result) TYPE REF TO zcl_mcp_schema_builder
      RAISING   zcx_mcp_ajson_error.

    METHODS run_async_task_test
      IMPORTING !request  TYPE REF TO zcl_mcp_req_call_tool
      CHANGING  !response TYPE zif_mcp_server=>call_tool_response.
ENDCLASS.



CLASS zcl_mcp_test_full IMPLEMENTATION.
  METHOD handle_initialize.
    " Icons on a single struct (not iterated via FIELD-SYMBOL) — VALUE #() inline is safe here
    response-result->set_implementation(
        VALUE #( name        = `Test Server with full feature set`
                 version     = `1.0`
                 title       = `Full Feature Test Server`
                 description = `Exercises all MCP 2025-11-25 features including tasks and icons`
                 icons       = VALUE zif_mcp_types=>icon_list( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                                                               mime_type = `image/gif`
                                                               ( sizes     = VALUE #( ( `16x16` ) ( `32x32` ) ) )
                                                               ( theme     = `dark` ) ) ) ) ##NO_TEXT.

    response-result->set_capabilities( VALUE #( prompts     = VALUE #( enabled = abap_true )
                                                resources   = VALUE #( enabled = abap_true )
                                                tools       = VALUE #( enabled = abap_true )
                                                tasks       = VALUE #( list       = abap_true
                                                                       cancel     = abap_true
                                                                       tools_call = abap_true )
                                                completions = abap_true ) ).

    response-result->set_instructions( `Use this server to test the implementation.` ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_list_prompts.
    DATA(meta) = zcl_mcp_ajson=>create_empty( ).
    TRY.
        meta->set( iv_path = `abapai~1test1` iv_val = `This is a test meta information` ).
        meta->set( iv_path = `abapai~1test2` iv_val = `This is another test meta information` ).
      CATCH zcx_mcp_ajson_error.
        RETURN.
    ENDTRY.

    " Explicit build required — icon_list is a nested internal table;
    " VALUE #() inline constructors cause FIELD-SYMBOL failures in the JSON generator
    DATA prompts TYPE zcl_mcp_resp_list_prompts=>prompts.
    DATA prompt  TYPE zcl_mcp_resp_list_prompts=>prompt.

    prompt-name        = `simple`.
    prompt-description = `Simple test prompt` ##NO_TEXT.
    APPEND VALUE #( src = `/sap/public/bc/WebIcons/w_s_okay.gif` mime_type = `image/gif` ) TO prompt-icons.
    APPEND prompt TO prompts.

    CLEAR prompt.
    prompt-name        = `complex`.
    prompt-description = `A more complex test prompt with two arguments` ##NO_TEXT.
    APPEND VALUE #( src = `/sap/public/bc/WebIcons/w_s_okay.gif` mime_type = `image/gif` ) TO prompt-icons.
    prompt-arguments   = VALUE #(
        ( name = `optional` description = `Optional argument` required = abap_false )
        ( name = `required` description = `Required argument` required = abap_true ) ) ##NO_TEXT.
    APPEND prompt TO prompts.

    " No icon on these two — exercises both branches in the JSON generator
    APPEND VALUE #( name = `all_content_types`
                    description = `A test prompt that returns all five content types` ) TO prompts ##NO_TEXT.
    APPEND VALUE #( name = `ordered`
                    description = `Multiple responses to ensure order is preserved` ) TO prompts ##NO_TEXT.

    CLEAR prompt.
    prompt-name        = `test_meta`.
    prompt-description = `Adding Meta Information` ##NO_TEXT.
    prompt-title       = `Test Meta Tile` ##NO_TEXT.
    prompt-meta        = meta.
    APPEND VALUE #( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                    mime_type = `image/gif`
                    sizes     = VALUE #( ( `16x16` ) )
                    theme     = `light` ) TO prompt-icons.
    prompt-arguments = VALUE #(
        ( name = `testArg` title = `Test Arg Title` description = `Test Arg Description` ) ) ##NO_TEXT.
    APPEND prompt TO prompts.

    response-result->set_prompts( prompts ).
  ENDMETHOD.

  METHOD handle_get_prompt.
    DATA(arguments) = request->get_arguments( ).
    CASE request->get_name( ).
      WHEN `simple`.
        response-result->set_description( `Simple test prompt` ) ##NO_TEXT.
        response-result->add_text_message( role = zif_mcp_types=>role_user
                                           text = |This is a simple test prompt| ) ##NO_TEXT.

      WHEN `complex`.
        READ TABLE arguments INTO DATA(argument) WITH KEY key = `required`.
        IF sy-subrc <> 0.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
          response-error-message = |Prompt { request->get_name( ) } requires parameter 'required'| ##NO_TEXT.
        ELSE.
          response-result->set_description( `A more complex test prompt with two arguments` ) ##NO_TEXT.
          DATA(required_value) = argument-value.
          READ TABLE arguments INTO argument WITH KEY key = `optional`.
          DATA(optional_text) = COND #( WHEN sy-subrc = 0
                                        THEN | with optional parameter '{ argument-value }'|
                                        ELSE || ) ##NO_TEXT.
          response-result->add_text_message(
              role = zif_mcp_types=>role_user
              text = |Execute a complex test with required parameter '{ required_value }'{ optional_text }| ) ##NO_TEXT.
        ENDIF.

      WHEN `all_content_types`.
        DATA(meta) = zcl_mcp_ajson=>create_empty( ).
        DATA(meta2) = zcl_mcp_ajson=>create_empty( ).
        TRY.
            meta->set( iv_path = `abapai~1promptTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            RETURN.
        ENDTRY.
        response-result->set_description( `A test prompt that returns all five content types` ) ##NO_TEXT.
        response-result->set_meta( meta ).
        response-result->add_text_message( role = zif_mcp_types=>role_user
                                           text = |Text Message| ) ##NO_TEXT.
        DATA(gif) = get_gif( ).
        response-result->add_image_message( role      = zif_mcp_types=>role_user
                                            data      = gif
                                            mime_type = 'image/gif' ) ##NO_TEXT.
        response-result->add_text_resource_message( role      = zif_mcp_types=>role_user
                                                    uri       = 'file://testfile.md'
                                                    text      = '# Test File\n'
                                                    mime_type = 'text/markdown' ).
        response-result->add_blob_resource_message( role      = zif_mcp_types=>role_user
                                                    uri       = 'file://okay-.gif'
                                                    blob      = gif
                                                    mime_type = 'image/gif' ).
        response-result->add_audio_message( role      = zif_mcp_types=>role_user
                                            data      = gif
                                            mime_type = 'audio/wav' ).
        response-result->add_resource_link_message( description = `Resource Link`
                                                    title       = `Link Title`
                                                    name        = `Link Name`
                                                    role        = zif_mcp_types=>role_user
                                                    uri         = `http://blubb.wuff/abcdf`
                                                    meta        = meta2 ) ##NO_TEXT.

      WHEN `ordered`.
        response-result->add_text_message( role = zif_mcp_types=>role_user
                                           text = |This is the first message| ) ##NO_TEXT.
        response-result->add_text_resource_message( role      = zif_mcp_types=>role_user
                                                    uri       = 'file://testfile.md'
                                                    text      = 'This is the second message'
                                                    mime_type = 'text/markdown' ) ##NO_TEXT.
        response-result->add_text_message( role = zif_mcp_types=>role_user
                                           text = |This is the third message| ) ##NO_TEXT.

      WHEN `test_meta`.
        meta = zcl_mcp_ajson=>create_empty( ).
        meta2 = zcl_mcp_ajson=>create_empty( ).
        TRY.
            meta->set( iv_path = `abapai~1promptTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            RETURN.
        ENDTRY.
        response-result->set_description( `Adding Meta Information` ) ##NO_TEXT.
        response-result->set_meta( meta ).
        response-result->add_resource_link_message( description = `Resource Link`
                                                    title       = `Link Title`
                                                    name        = `Link Name`
                                                    role        = zif_mcp_types=>role_user
                                                    uri         = `http://blubb.wuff/abcdf`
                                                    meta        = meta2 ) ##NO_TEXT.

      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Prompt { request->get_name( ) } not found.| ##NO_TEXT.
    ENDCASE.
  ENDMETHOD.

  METHOD get_gif.
    DATA(api) = cl_mime_repository_api=>get_api( ).
    DATA gif TYPE xstring.
    api->get( EXPORTING  i_url              = 'sap/public/bc/WebIcons/w_s_okay.gif'
              IMPORTING  e_content          = gif
              EXCEPTIONS parameter_missing  = 1
                         error_occured      = 2
                         not_found          = 3
                         permission_failure = 4
                         OTHERS             = 5 ).
    IF sy-subrc <> 0.
      RETURN.
    ENDIF.
    CALL FUNCTION 'SCMS_BASE64_ENCODE_STR'
      EXPORTING
        input  = gif
      IMPORTING
        output = result
      EXCEPTIONS
        OTHERS = 0.
  ENDMETHOD.

  METHOD handle_list_resources.
    " Explicit build — same nested-table rule as prompts/tools
    DATA resources TYPE zcl_mcp_resp_list_resources=>resources.
    DATA resource  TYPE zcl_mcp_resp_list_resources=>resource.

    resource-name        = `OK`.
    resource-uri         = `file://sap/okay.gif`.
    resource-description = `Okay Gif` ##NO_TEXT.
    resource-mime_type   = `image/gif`.
    APPEND VALUE #( src = `/sap/public/bc/WebIcons/w_s_okay.gif` mime_type = `image/gif` ) TO resource-icons.
    APPEND resource TO resources.

    CLEAR resource.
    resource-name        = `OK2`.
    resource-uri         = `file://sap/okay2.gif`.
    resource-description = `Same Okay Gif` ##NO_TEXT.
    resource-mime_type   = `image/gif`.
    APPEND VALUE #( src = `/sap/public/bc/WebIcons/w_s_okay.gif` mime_type = `image/gif` ) TO resource-icons.
    APPEND resource TO resources.

    " No icon — exercises both branches in the JSON generator
    APPEND VALUE #( name      = `TextFile`
                    uri       = `file://sap/text.json`
                    description = `Same Json Text`
                    mime_type = `text/json` ) TO resources ##NO_TEXT.

    response-result->set_resources( resources ).
  ENDMETHOD.

  METHOD handle_list_res_tmpls.
    response-result->set_resource_templates(
        VALUE #( ( mime_type    = `image/gif`
                   name        = `Gif`
                   uritemplate = `file://{path}`
                   description = `Gifs ...` ) ) ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_resources_read.
    DATA(uri) = request->get_uri( ).
    CASE uri.
      WHEN `file://sap/okay.gif`.
        DATA(gif) = get_gif( ).
        response-result->add_blob_resource( uri       = uri
                                            blob      = gif
                                            mime_type = 'image/gif' ) ##NO_TEXT.
      WHEN `file://sap/okay2.gif`.
        gif = get_gif( ).
        response-result->add_blob_resource( uri       = uri
                                            blob      = gif
                                            mime_type = 'image/gif' ) ##NO_TEXT.
      WHEN `file://sap/text.json`.
        response-result->add_text_resource( uri       = uri
                                            text      = '{ "key": "value" }'
                                            mime_type = 'text/json' ) ##NO_TEXT.
      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Resource { uri } not found.| ##NO_TEXT.
    ENDCASE.
  ENDMETHOD.

  METHOD handle_list_tools.
    DATA tools TYPE zcl_mcp_resp_list_tools=>tools.
    DATA tool  TYPE zcl_mcp_resp_list_tools=>tool.

    " --- All Content Types: icon, no schema ---
    tool-name        = `All Content Types`.
    tool-description = `A test tool that returns all content types` ##NO_TEXT.
    APPEND VALUE #( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                    mime_type = `image/gif` ) TO tool-icons.
    APPEND tool TO tools.

    " --- Input Test: icon + input schema ---
    TRY.
        CLEAR tool.
        tool-name         = `Input Test`.
        tool-description  = `A test tool with a complex input` ##NO_TEXT.
        tool-input_schema = get_input_schema( )->to_json( ).
        APPEND VALUE #( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                        mime_type = `image/gif` ) TO tool-icons.
        APPEND tool TO tools.
      CATCH zcx_mcp_ajson_error INTO DATA(schema_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = schema_error->get_text( ).
        RETURN.
    ENDTRY.

    " --- Error Test: no icon — exercises both branches in the JSON generator ---
    APPEND VALUE #( name        = `Error Test`
                    description = `A test tool that always returns error as true` ) TO tools ##NO_TEXT.

    " --- Structured Output Test: icon + meta + output schema ---
    TRY.
        CLEAR tool.
        DATA(meta) = zcl_mcp_ajson=>create_empty( ).
        meta->set( iv_path = `abapai~1toolTest`
                   iv_val  = `This is a test meta information` ).

        DATA(output_schema) = NEW zcl_mcp_schema_builder( ).
        output_schema->add_string( name        = `test_string`
                                   description = `Just a test string`
                                   required    = abap_true ) ##NO_TEXT.
        output_schema->begin_object( `test_object` ) ##NO_TEXT.
        output_schema->add_string( name        = `test_object_string`
                                   description = `Just a test string in an object`
                                   required    = abap_true ) ##NO_TEXT.
        output_schema->add_integer( name        = `test_object_integer`
                                    description = `Just a test integer in an object`
                                    required    = abap_true ) ##NO_TEXT.
        output_schema->end_object( ).

        tool-name          = `Structured Output Test`.
        tool-description   = `Test for structured output` ##NO_TEXT.
        tool-title         = `Test for structured output` ##NO_TEXT.
        tool-meta          = meta.
        tool-output_schema = output_schema->to_json( ).
        APPEND VALUE #( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                        mime_type = `image/gif` ) TO tool-icons.
        APPEND tool TO tools.
      CATCH zcx_mcp_ajson_error INTO DATA(output_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = output_error->get_text( ).
        RETURN.
    ENDTRY.

    " --- Async Task Test: execution + icon with sizes/theme ---
    TRY.
        CLEAR tool.
        tool-name         = `Async Task Test`.
        tool-description  = |Tests the full task lifecycle. mode=complete: immediate result; |
                           && |mode=fail: immediate failure; mode=stay_working: stays running |
                           && |for polling and cancellation testing.| ##NO_TEXT.
        tool-execution    = VALUE #( task_support = zcl_mcp_resp_list_tools=>task_support-optional ).
        tool-input_schema = get_async_task_schema( )->to_json( ).
        APPEND VALUE #( src       = `/sap/public/bc/WebIcons/w_s_okay.gif`
                        mime_type = `image/gif`
                        sizes     = VALUE #( ( `16x16` ) ( `32x32` ) ) ) TO tool-icons.
        APPEND tool TO tools.

        CLEAR tool.
        tool-name         = `Required Task Test`.
        tool-description  = `Requires task-augmented execution.` ##NO_TEXT.
        tool-execution    = VALUE #( task_support = zcl_mcp_resp_list_tools=>task_support-required ).
        tool-input_schema = get_async_task_schema( )->to_json( ).
        APPEND tool TO tools.
      CATCH zcx_mcp_ajson_error INTO DATA(async_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = async_error->get_text( ).
        RETURN.
    ENDTRY.

    response-result->set_tools( tools ).
  ENDMETHOD.

  METHOD handle_call_tool.
    DATA(tool_name) = request->get_name( ).

    CASE tool_name.
      WHEN 'All Content Types'.
        DATA(meta) = zcl_mcp_ajson=>create_empty( ).
        DATA(meta2) = zcl_mcp_ajson=>create_empty( ).
        TRY.
            meta->set( iv_path = `abapai~1toolTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            RETURN.
        ENDTRY.
        response-result->set_meta( meta ).
        response-result->add_text_content( |Text Message| ) ##NO_TEXT.
        DATA(gif) = get_gif( ).
        response-result->add_image_content( data      = gif
                                            mime_type = 'image/gif' ) ##NO_TEXT.
        response-result->add_text_resource( uri       = 'file://testfile.md'
                                            text      = '# Test File\n'
                                            mime_type = 'text/markdown' ) ##NO_TEXT.
        response-result->add_blob_resource( uri       = 'file://okay-.gif'
                                            blob      = gif
                                            mime_type = 'image/gif' ) ##NO_TEXT.
        response-result->add_audio_content( data      = gif
                                            mime_type = 'audio/wav' ) ##NO_TEXT.
        response-result->add_resource_link( description = `Resource Link`
                                            title       = `Link Title`
                                            name        = `Link Name`
                                            uri         = `http://blubb.wuff/abcdf`
                                            meta        = meta2 ) ##NO_TEXT.

      WHEN 'Error Test'.
        response-result->set_error( ).
        response-result->add_text_content( |This is an error test| ) ##NO_TEXT.

      WHEN 'Input Test'.
        DATA(arguments) = request->get_arguments( ).
        TRY.
            DATA(schema) = get_input_schema( ).
            DATA(validator) = NEW zcl_mcp_schema_validator( schema->to_json( ) ).
            DATA(validation_result) = validator->validate( arguments ).
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
        " TODO: variable is assigned but never used (ABAP cleaner)
        DATA(text_input) = arguments->get_string( `TextInput` ).
        DATA: BEGIN OF input_line,
                line TYPE i,
                text TYPE string,
              END OF input_line,
              input_array LIKE STANDARD TABLE OF input_line WITH EMPTY KEY.
        DATA(input_table) = arguments->slice( `TestInputArray` ).
        TRY.
            input_table->to_abap( IMPORTING ev_container = input_array ).
          CATCH zcx_mcp_ajson_error.
            response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
            response-error-message = |Incorrect Input parameter format| ##NO_TEXT.
            RETURN.
        ENDTRY.
        LOOP AT input_array ASSIGNING FIELD-SYMBOL(<input_array>).
          response-result->add_text_content( |Line { <input_array>-line } : { <input_array>-text }| ) ##NO_TEXT.
        ENDLOOP.

      WHEN `Structured Output Test`.
        DATA(output) = zcl_mcp_ajson=>create_empty( ).
        TRY.
            output->set( iv_path = `test_string`
                         iv_val  = `This is a test string` ).
            output->set( iv_path = `test_object/test_object_string`
                         iv_val  = `This is a test string in an object` ).
            output->set( iv_path = `test_object/test_object_integer`
                         iv_val  = 42 ).
          CATCH zcx_mcp_ajson_error.
            response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
            response-error-message = |Error creating tool output| ##NO_TEXT.
            RETURN.
        ENDTRY.
        response-result->set_structured_content( output ).

      WHEN `Async Task Test`.
        run_async_task_test( EXPORTING request  = request
                             CHANGING  response = response ).

      WHEN `Required Task Test`.
        IF request->has_task( ) = abap_false.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_request.
          response-error-message = `Required Task Test requires task execution` ##NO_TEXT.
          RETURN.
        ENDIF.

        run_async_task_test( EXPORTING request  = request
                             CHANGING  response = response ).
      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Tool { tool_name } not found.| ##NO_TEXT.
    ENDCASE.
  ENDMETHOD.

  METHOD handle_cancel_task.
    " Guard: reject cancellation of already-terminal tasks with a clear error.
    " (The base class would also throw via is_valid_transition, but as internal_error.)
    DATA(task_id) = request->get_task_id( ).
    TRY.
        DATA(task) = get_tasks( )->get( CONV sysuuid_c32( task_id ) ).
      CATCH zcx_mcp_server INTO DATA(err).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = err->get_text( ).
        RETURN.
    ENDTRY.

    IF task-status = zcl_mcp_tasks=>status_completed
    OR task-status = zcl_mcp_tasks=>status_failed
    OR task-status = zcl_mcp_tasks=>status_cancelled.
      response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
      response-error-message =
          |Task { task_id } is already in terminal state '{ task-status }'| ##NO_TEXT.
      RETURN.
    ENDIF.
  ENDMETHOD.

  METHOD get_session_mode.
    result = zcl_mcp_session=>session_mode_stateless.
  ENDMETHOD.

  METHOD get_input_schema.
    DATA(schema) = NEW zcl_mcp_schema_builder( ).
    schema->add_string( name        = `TextInput`
                        description = `Input text with a maximum of 100 characters`
                        required    = abap_true
                        max_length  = 100 ) ##NO_TEXT.
    schema->begin_array( `TestInputArray` ) ##NO_TEXT.
    schema->add_integer( name        = `Line`
                         description = `Line number`
                         required    = abap_true ) ##NO_TEXT.
    schema->add_string( name        = `Text`
                        description = `Text`
                        required    = abap_true ) ##NO_TEXT.
    schema->end_array( ).
    result = schema.
  ENDMETHOD.

  METHOD get_async_task_schema.
    DATA(schema) = NEW zcl_mcp_schema_builder( ).
    schema->add_string( name        = `mode`
                        description = |complete: succeed asynchronously; fail: fail immediately; |
                                   && |complete_error: complete with isError payload; |
                                   && |stay_working: stay running for polling/cancel testing|
                        required    = abap_true
                        enum        = VALUE #( ( `complete` ) ( `fail` ) ( `complete_error` ) ( `stay_working` ) ) ) ##NO_TEXT.
    schema->add_integer( name        = `value`
                         description = `Integer to square in the completed result (default 0)`
                         required    = abap_false
                         minimum     = 0
                         maximum     = 1000 ) ##NO_TEXT.
    result = schema.
  ENDMETHOD.

  METHOD handle_completions_complete.
    DATA all_candidates TYPE zcl_mcp_resp_complete=>completion_values.

    DATA(ref_type)  = request->get_ref_type( ).
    DATA(arg_name)  = request->get_argument_name( ).
    DATA(arg_value) = request->get_argument_value( ).

    CASE ref_type.

      WHEN zcl_mcp_req_complete=>ref_type-prompt.
        CASE request->get_ref_name( ).

          WHEN 'complex'.
            CASE arg_name.
              WHEN 'required'.
                all_candidates = VALUE #( ( `value1` ) ( `value2` ) ( `value3` ) ).

              WHEN 'optional'.
                " Demonstrate context: adjust candidates based on already-filled required arg
                DATA req_val TYPE string.
                IF request->has_context( ) = abap_true.
                  TRY.
                      DATA(ctx) = request->get_context_json( ).
                      IF ctx->exists( '/arguments/required' ).
                        req_val = ctx->get_string( '/arguments/required' ).
                      ENDIF.
                    CATCH zcx_mcp_ajson_error.
                      CLEAR req_val.
                  ENDTRY.
                ENDIF.
                IF req_val IS NOT INITIAL.
                  all_candidates = VALUE #( ( |opt_for_{ req_val }_a| )
                                            ( |opt_for_{ req_val }_b| ) ).
                ELSE.
                  all_candidates = VALUE #( ( `opt1` ) ( `opt2` ) ( `opt3` ) ).
                ENDIF.
                " Demonstrate pagination fields
                response-result->set_total( 10 ).
                response-result->set_has_more( abap_true ).
            ENDCASE.

          WHEN 'test_meta'.
            IF arg_name = 'testArg'.
              all_candidates = VALUE #( ( `arg_value_a` )
                                        ( `arg_value_b` )
                                        ( `arg_value_c` ) ).
            ENDIF.

          WHEN OTHERS.
            " Prompts simple / all_content_types / ordered have no completable args
        ENDCASE.

      WHEN zcl_mcp_req_complete=>ref_type-resource.
        IF request->get_ref_uri( ) = 'file://{path}' AND arg_name = 'path'.
          all_candidates = VALUE #( ( `/home` ) ( `/tmp` ) ( `/usr` ) ( `/var` ) ).
        ENDIF.

    ENDCASE.

    " Prefix-filter candidates by the partial value typed so far
    LOOP AT all_candidates INTO DATA(candidate).
      IF NOT ( arg_value IS INITIAL OR candidate CP |{ arg_value }*| ).
        CONTINUE.
      ENDIF.
      response-result->add_value( candidate ).
    ENDLOOP.
  ENDMETHOD.

  METHOD run_async_task_test.
    IF request->has_task( ).
      TRY.
          DATA(args)    = request->get_arguments( ).
          DATA(mode)    = args->get_string( `mode` ).
          DATA(value)   = args->get_integer( `value` ).
          DATA(ttl)     = COND i( WHEN request->get_task_ttl( ) > 0
                                  THEN request->get_task_ttl( )
                                  ELSE 3600000 ).

          DATA(task_id) = get_tasks( )->create_task( tool_name = request->get_name( )
                                                     ttl       = ttl ).

          CASE mode.
            WHEN `complete`.
              DATA job_count TYPE tbtcjob-jobcount.

              CALL FUNCTION 'JOB_OPEN'
                EXPORTING  jobname  = 'ZMCP_ASYNC_TEST'
                IMPORTING  jobcount = job_count
                EXCEPTIONS OTHERS   = 1.

              IF sy-subrc <> 0.
                zcl_mcp_tasks=>fail( task_id = task_id
                                     message = 'Failed to open background job' ) ##NO_TEXT.
              ELSE.
                SUBMIT zmcp_demo_bg_task
                       WITH p_taskid = task_id
                       WITH p_value  = value
                       VIA JOB 'ZMCP_ASYNC_TEST' NUMBER job_count
                       AND RETURN.

                CALL FUNCTION 'JOB_CLOSE'
                  EXPORTING  jobcount  = job_count
                             jobname   = 'ZMCP_ASYNC_TEST'
                             strtimmed = abap_true
                  EXCEPTIONS OTHERS    = 1.

                IF sy-subrc <> 0.
                  zcl_mcp_tasks=>fail( task_id = task_id
                                       message = 'Failed to schedule background job' ) ##NO_TEXT.
                ENDIF.
              ENDIF.

            WHEN `complete_error`.
              DATA(task_result) = NEW zcl_mcp_resp_task_payload( ).
              task_result->set_is_error( abap_true ).
              task_result->add_text_content( `Simulated task result error for testing` ) ##NO_TEXT.

              zcl_mcp_tasks=>complete( task_id = task_id
                                       result  = task_result ).

            WHEN `fail`.
              zcl_mcp_tasks=>fail( task_id = task_id
                                   message = `Simulated task failure for testing` ) ##NO_TEXT.

            WHEN `stay_working`.
              " Task is already in 'working' - client tests polling and cancel.

            WHEN OTHERS.
              zcl_mcp_tasks=>fail( task_id = task_id
                                   message = |Unknown mode '{ mode }'| ) ##NO_TEXT.
          ENDCASE.

          DATA(task) = get_tasks( )->get( task_id ).
          response-result->set_task_result( task ).

        CATCH zcx_mcp_server INTO DATA(task_error).
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
          response-error-message = task_error->get_text( ).

        CATCH zcx_mcp_ajson_error INTO DATA(json_error).
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
          response-error-message = json_error->get_text( ).
      ENDTRY.

    ELSE.
      TRY.
          DATA(sync_value) = request->get_arguments( )->get_integer( `value` ).
          response-result->add_text_content( |{ sync_value }² = { sync_value * sync_value } (synchronous execution)| ) ##NO_TEXT.
        CATCH zcx_mcp_ajson_error.
          response-result->add_text_content( `Async Task Test - synchronous execution` ) ##NO_TEXT.
      ENDTRY.
    ENDIF.
  ENDMETHOD.

ENDCLASS.
