CLASS zcl_mcp_test_annotations DEFINITION
  PUBLIC
  INHERITING FROM zcl_mcp_server_base
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
  PROTECTED SECTION.
    METHODS handle_initialize     REDEFINITION.
    METHODS get_session_mode      REDEFINITION.
    METHODS handle_list_tools     REDEFINITION.
    METHODS handle_list_resources REDEFINITION.
    METHODS handle_list_res_tmpls REDEFINITION.
    METHODS handle_call_tool      REDEFINITION.

  PRIVATE SECTION.
ENDCLASS.



CLASS zcl_mcp_test_annotations IMPLEMENTATION.
  METHOD get_session_mode.
    result = zcl_mcp_session=>session_mode_stateless.
  ENDMETHOD.

  METHOD handle_initialize.
    response-result->set_implementation( VALUE #( name    = `Test Server for Annotations`
                                                  version = `1.0` ) ) ##NO_TEXT.
    response-result->set_capabilities( VALUE #( prompts   = abap_true
                                                resources = abap_true
                                                tools     = abap_true ) ).
    response-result->set_instructions( `Use this server to test the implementation` ) ##NO_TEXT.
  ENDMETHOD.

  METHOD handle_list_tools.
    response-result->set_tools(
        VALUE #(
            ( name        = `AllHints`
              description = `A test tool with all Hints active`
              annotations = VALUE #( destructivehint = abap_true
                                     idempotenthint  = abap_true
                                     openworldhint   = abap_true
                                     readonlyhint    = abap_true
                                     title           = `Human Readable Title` ) )
            ( name        = `DestructiveOnly`
              description = `Destructive Hint`
              annotations = VALUE #( destructivehint = abap_true ) )
            ( name = `ReadOnly` description = `Read Only` annotations = VALUE #( readonlyhint = abap_true ) )
            ( name = `OpenWorldOnly` description = `OpenWorld Only` annotations = VALUE #( openworldhint = abap_true ) )
            ( name        = `IdempotentOnly`
              description = `Idempotent Only`
              annotations = VALUE #( idempotenthint = abap_true ) ) ) ).
  ENDMETHOD.

  METHOD handle_list_resources.
    response-result->set_resources( VALUE #(
                                        ( name        = `annotation_test_resource`
                                          uri         = `http://example.com/annotation_test_resource`
                                          mime_type   = `text`
                                          annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_user ) )
                                                                 priority = '0.1' ) ) ) ).
  ENDMETHOD.

  METHOD handle_list_res_tmpls.
    response-result->set_resource_templates( VALUE #( ( name        = `annotation_test_resource_template`
                                                        description = `Test Resource Template`
                                                        mime_type   = `text`
                                                        annotations = VALUE #(
                                                            audience = VALUE #( ( zif_mcp_server=>role_user ) )
                                                            priority = '0.1' ) ) ) ).
  ENDMETHOD.

  METHOD handle_call_tool.
    " We just use one dummy tool call for all data type annotations
    IF request->get_name( ) <> `AllHints`.
      RETURN.
    ENDIF.

    response-result->add_audio_content( mime_type   = `audio/mpeg`
                                        annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_user ) ) priority = '0.1' )
                                        data        = `SGVsbG8=` ).
    response-result->add_blob_resource( uri         = `http://example.com/blob`
                                        mime_type   = `application/octet-stream`
                                        annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_user ) )
                                                               priority = '0.1' )
                                        blob        = `SGVsbG8=` ).
    response-result->add_image_content( mime_type   = `image/png`
                                        annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_user ) )
                                                               priority = '0.1' )
                                        data        = `SGVsbG8=` ).
    response-result->add_text_resource( uri         = `http://example.com/text`
                                        mime_type   = `text/plain`
                                        annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_user ) )
                                                               priority = '0.1' )
                                        text        = `This is a dummy text resource` ).
    response-result->add_text_content( annotations = VALUE #( audience = VALUE #( ( zif_mcp_server=>role_assistant ) )
                                                              priority = '0.1' )
                                       text        = `Dummy Text` ).
  ENDMETHOD.

ENDCLASS.
