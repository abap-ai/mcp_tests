"! <p class="shorttext synchronized" lang="en">Full Test Server</p>
CLASS zcl_mcp_test_full DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.

  PROTECTED SECTION.
    METHODS handle_initialize   REDEFINITION.
    METHODS handle_list_prompts REDEFINITION.
    METHODS handle_get_prompt   REDEFINITION.
    METHODS handle_list_resources REDEFINITION.
    METHODS handle_resources_read REDEFINITION.
    METHODS handle_list_res_tmpls REDEFINITION.
    METHODS handle_list_tools REDEFINITION.
    METHODS handle_call_tool REDEFINITION.
    METHODS: get_session_mode REDEFINITION.

  PRIVATE SECTION.
    METHODS get_gif RETURNING VALUE(result) TYPE string.
    METHODS get_input_schema RETURNING VALUE(result) TYPE REF TO zcl_mcp_schema_builder RAISING zcx_mcp_ajson_error.
ENDCLASS.



CLASS zcl_mcp_test_full IMPLEMENTATION.
  METHOD handle_initialize.
    response-result->set_implementation( VALUE #( name    = `Test Server with full feature set`
                                                  version = `1.0` ) ) ##NO_TEXT.
    response-result->set_capabilities( VALUE #( prompts   = abap_true
                                                resources = abap_true
                                                tools     = abap_true ) ).
    response-result->set_instructions( `Use this server to test the implementation` ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_list_prompts.
    DATA(meta) = zcl_mcp_ajson=>create_empty( ).

    TRY.
        " Hint: Slash in the path is replaced by ~1
        meta->set( iv_path = `abapai~1test1`
                   iv_val  = `This is a test meta information` ).
        meta->set( iv_path = `abapai~1test2`
                   iv_val  = `This is another test meta information` ).
      CATCH zcx_mcp_ajson_error.
        " No need to handle, the test will fail then
        RETURN.
    ENDTRY.

    response-result->set_prompts(
        VALUE #(
            ( name        = `simple`
              description = `Simple test prompt` )
            ( name        = `complex`
              description = `A more complex test prompt with two arguments`
              arguments   = VALUE #( ( name = `optional` description = `Optional argument` required = abap_false )
                                     ( name = `required` description = `Required argument` required = abap_true ) ) )
            ( name = `all_content_types` description = `A test prompt that returns all five content types` )
            ( name = `ordered` description = `Multiple responses to ensure order is preserved` )
            ( name        = `test_meta`
              description = `Adding Meta Information`
              meta        = meta
              title       = `Test Meta Tile`
              arguments   = VALUE #( ( name = `testArg` title = `Test Arg Title` description = `Test Arg Description` ) )  ) ) ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_get_prompt.
    " In this example we handle prompts defined in handle_list_prompts
    DATA(arguments) = request->get_arguments( ).
    CASE request->get_name( ).
      WHEN `simple`.
        " Simple prompt with no arguments
        response-result->set_description( `Simple test prompt` ) ##NO_TEXT.
        response-result->add_text_message( role = zif_mcp_server=>role_user
                                           text = |This is a simple test prompt| ) ##NO_TEXT.
      WHEN `complex`.
        " Complex prompt with required parameter
        READ TABLE arguments INTO DATA(argument) WITH KEY key = `required`.
        IF sy-subrc <> 0.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
          response-error-message = |Prompt { request->get_name( ) } requires parameter 'required'| ##NO_TEXT.
        ELSE.
          response-result->set_description( `A more complex test prompt with two arguments` ) ##NO_TEXT.

          " Store the required value
          DATA(required_value) = argument-value.

          " Check for optional parameter
          READ TABLE arguments INTO argument WITH KEY key = `optional`.
          DATA(optional_text) = COND #( WHEN sy-subrc = 0
                                        THEN | with optional parameter '{ argument-value }'|
                                        ELSE || ) ##NO_TEXT.

          response-result->add_text_message(
              role = zif_mcp_server=>role_user
              text = |Execute a complex test with required parameter '{ required_value }'{ optional_text }| ) ##NO_TEXT.
        ENDIF.

      WHEN `all_content_types`.
        " Test prompt that returns meta information`
        DATA(meta) = zcl_mcp_ajson=>create_empty( ).
        DATA(meta2) = zcl_mcp_ajson=>create_empty( ).
        TRY.
            " Hint: Slash in the path is replaced by ~1
            meta->set( iv_path = `abapai~1promptTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            " No need to handle, the test will fail then
            RETURN.
        ENDTRY.

        response-result->set_description( `A test prompt that returns all five content types` ) ##NO_TEXT.
        response-result->set_meta( meta ).

        " Test prompt that returns all five content types
        response-result->add_text_message( role = zif_mcp_server=>role_user
                                           text = |Text Message| ) ##NO_TEXT.

        DATA(gif) = get_gif( ).
        response-result->add_image_message( role      = zif_mcp_server=>role_user
                                            data      = gif
                                            mime_type = 'image/gif' )
        ##NO_TEXT.

        response-result->add_text_resource_message( role      = zif_mcp_server=>role_user
                                                    uri       = 'file://testfile.md'
                                                    text      = '# Test File\n'
                                                    mime_type = 'text/markdown' ).

        " We reuse the gif from image content, usually you'd use e.g. PDFs or other files
        response-result->add_blob_resource_message( role      = zif_mcp_server=>role_user
                                                    uri       = 'file://okay-.gif'
                                                    blob      = gif
                                                    mime_type = 'image/gif' ).

        " We reuse the gif from image content, usually you'd use e.g. wav files
        response-result->add_audio_message( role      = zif_mcp_server=>role_user
                                            data      = gif
                                            mime_type = 'audio/wav' ).

        response-result->add_resource_link_message( description = `Resource Link`
                                                    title       = `Link Title`
                                                    name        = `Link Name`
                                                    role        = zif_mcp_server=>role_user
                                                    uri         = `http://blubb.wuff/abcdf`
                                                    meta        = meta2 ) ##NO_TEXT.

      WHEN `ordered`.
        " Test prompt that returns multiple messages
        response-result->add_text_message( role = zif_mcp_server=>role_user
                                           text = |This is the first message| ) ##NO_TEXT.
        response-result->add_text_resource_message( role      = zif_mcp_server=>role_user
                                                    uri       = 'file://testfile.md'
                                                    text      = 'This is the second message'
                                                    mime_type = 'text/markdown' ) ##NO_TEXT.
        response-result->add_text_message( role = zif_mcp_server=>role_user
                                           text = |This is the third message| ) ##NO_TEXT.

      WHEN `test_meta`.
        " Test prompt that returns meta information`
        meta = zcl_mcp_ajson=>create_empty( ).
        meta2 = zcl_mcp_ajson=>create_empty( ).
        TRY.
            " Hint: Slash in the path is replaced by ~1
            meta->set( iv_path = `abapai~1promptTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            " No need to handle, the test will fail then
            RETURN.
        ENDTRY.
        response-result->set_description( `Adding Meta Information` ) ##NO_TEXT.
        response-result->set_meta( meta ).
        response-result->add_resource_link_message( description = `Resource Link`
                                                    title       = `Link Title`
                                                    name        = `Link Name`
                                                    role        = zif_mcp_server=>role_user
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
              EXCEPTIONS parameter_missing  = 1                " Parameter missing or is initial
                         error_occured      = 2                " Unspecified Error Occurred
                         not_found          = 3                " Object not found
                         permission_failure = 4                " Missing Authorization
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
    response-result->set_resources(
        VALUE #(
            ( name = `OK` uri = `file://sap/okay.gif` description = `Okay Gif` mime_type = `image/gif` )
            ( name = `OK2` uri = `file://sap/okay2.gif` description = `Same Okay Gif` mime_type = 'image/gif' )
            ( name = `TextFile` uri = `file://sap/text.json` description = `Same Json Text` mime_type = `text/json` ) ) ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_list_res_tmpls.
    response-result->set_resource_templates(
        VALUE #( ( mime_type = 'image/gif' name = `Gif` uritemplate = `file://{path}` description = `Gifs ...` ) ) ) ##NO_TEXT.
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
    TRY.
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

        response-result->set_tools( VALUE #( ( name          = `All Content Types`
                                               description   = `A test tool that returns all content types` )
                                             ( name          = `Input Test`
                                               description   = `A test tool with a complex input`
                                               input_schema  = get_input_schema( )->to_json( ) )
                                             ( name          = `Error Test`
                                               description   = `A test tool that always return error as truet` )
                                             ( name          = `Structured Output Test`
                                               description   = `Test for structured output`
                                               meta          = meta
                                               output_schema = output_schema->to_json( )
                                               title         = `Test for structured ouptut` ) ) ) ##NO_TEXT.
      CATCH zcx_mcp_ajson_error.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = |Error creating tool definition| ##NO_TEXT.
    ENDTRY.
  ENDMETHOD.

  METHOD handle_call_tool.
    DATA(tool_name) = request->get_name( ).

    CASE tool_name.
      WHEN 'All Content Types'.
        DATA(meta) = zcl_mcp_ajson=>create_empty( ).
        DATA(meta2) = zcl_mcp_ajson=>create_empty( ).
        TRY.
            " Hint: Slash in the path is replaced by ~1
            meta->set( iv_path = `abapai~1toolTest`
                       iv_val  = `This is a test meta information` ).
            meta2->set( iv_path = `abapai~1reslinkTest`
                        iv_val  = `This is a test resource link meta information` ).
          CATCH zcx_mcp_ajson_error.
            " No need to handle, the test will fail then
            RETURN.
        ENDTRY.

        response-result->set_meta( meta ).
        response-result->add_text_content( |Text Message| ) ##NO_TEXT.
        " We reuse the gif from image content, usually you'd use appropriate files for the different content types
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
        " Note this is for when the tool was called correctly but has internal execution issues.
        " In case of a wrong call return response-error details.
        response-result->set_error( ).
        response-result->add_text_content( |This is an error test| ) ##NO_TEXT.

      WHEN 'Input Test'.
        DATA(arguments) = request->get_arguments( ).

        " Validate input parameter via schema validator class
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
        " This is a test for structured output
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
      WHEN OTHERS.
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = |Tool { tool_name } not found.| ##NO_TEXT.
    ENDCASE.
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

ENDCLASS.
