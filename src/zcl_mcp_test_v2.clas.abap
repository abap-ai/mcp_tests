"! <p class="shorttext synchronized">Draft V2 Test Server</p>
CLASS zcl_mcp_test_v2 DEFINITION
PUBLIC
INHERITING FROM zcl_mcp_server_base_v2 FINAL
CREATE PUBLIC.

  PROTECTED SECTION.
    METHODS get_implementation       REDEFINITION.
    METHODS get_capabilities         REDEFINITION.
    METHODS get_instructions         REDEFINITION.
    METHODS handle_prompts_list      REDEFINITION.
    METHODS handle_prompts_get       REDEFINITION.
    METHODS handle_resources_list    REDEFINITION.
    METHODS handle_resources_read    REDEFINITION.
    METHODS handle_res_tmpls_list    REDEFINITION.
    METHODS handle_tools_list        REDEFINITION.
    METHODS handle_tools_call        REDEFINITION.
    METHODS handle_completion        REDEFINITION.
    METHODS handle_tasks_get         REDEFINITION.
    METHODS handle_tasks_update      REDEFINITION.
    METHODS handle_tasks_cancel      REDEFINITION.
    METHODS handle_tool_input_schema REDEFINITION.

  PRIVATE SECTION.
    " Stable test task id, 32 hex chars for current task request parser.
    CONSTANTS c_task_id             TYPE string VALUE '00000000000000000000000000000001'.
    CONSTANTS c_task_input_id       TYPE string VALUE '00000000000000000000000000000002'.
    CONSTANTS c_task_error_id       TYPE string VALUE '00000000000000000000000000000003'.
    CONSTANTS c_persisted_task_tool TYPE string VALUE `start_persisted_input_task`.
    CONSTANTS c_unguarded_task_tool TYPE string VALUE `start_unguarded_task`.

    "! <p class="shorttext synchronized">Create JSON error response</p>
    "!
    "! @parameter error    | <p class="shorttext synchronized">JSON build error</p>
    "! @parameter response | <p class="shorttext synchronized">V2 error response</p>
    METHODS json_error
      IMPORTING !error          TYPE REF TO cx_root
      RETURNING VALUE(response) TYPE zif_mcp_server_v2=>v2_response.

    "! <p class="shorttext synchronized">Build tools/list result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Tools list result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_tools_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build normal tool result</p>
    "!
    "! @parameter message             | <p class="shorttext synchronized">Text content</p>
    "! @parameter result              | <p class="shorttext synchronized">Tool result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_text_tool_result
      IMPORTING !message      TYPE string
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build MRTR input required result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Input-required result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    "! @raising   zcx_mcp_server      | <p class="shorttext synchronized">Request state signing error</p>
    METHODS build_input_required
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error
                zcx_mcp_server.

    "! <p class="shorttext synchronized">Build task creation result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Task result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_task_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build task status result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Task status result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_task_get_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build prompts/list result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Prompts list result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_prompts_list_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build prompts/get result</p>
    "!
    "! @parameter topic               | <p class="shorttext synchronized">Prompt topic argument</p>
    "! @parameter result              | <p class="shorttext synchronized">Prompt get result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_prompt_get_result
      IMPORTING topic         TYPE string
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build resources/list result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Resources list result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_resources_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build resources/templates/list result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Resource templates result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_res_tmpls_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build resources/read result</p>
    "!
    "! @parameter uri                 | <p class="shorttext synchronized">Resource URI</p>
    "! @parameter text                | <p class="shorttext synchronized">Resource text override</p>
    "! @parameter result              | <p class="shorttext synchronized">Resource read result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_res_read_result
      IMPORTING uri           TYPE string
                !text         TYPE string OPTIONAL
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build completion/complete result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Completion result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_completion_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build cache and meta tool result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Cache/meta result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_cache_meta_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build input-required task status result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Task input-required result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    "! @raising   zcx_mcp_server      | <p class="shorttext synchronized">Request state signing error</p>
    METHODS build_task_input_req_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error
                zcx_mcp_server.

    "! <p class="shorttext synchronized">Build failed task status result</p>
    "!
    "! @parameter result              | <p class="shorttext synchronized">Task error result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_task_error_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    "! <p class="shorttext synchronized">Build tasks/update result</p>
    "!
    "! @parameter request             | <p class="shorttext synchronized">Task update request</p>
    "! @parameter result              | <p class="shorttext synchronized">Task update result JSON</p>
    "! @raising   zcx_mcp_ajson_error | <p class="shorttext synchronized">JSON build error</p>
    METHODS build_task_update_result
      IMPORTING !request      TYPE REF TO zcl_mcp_req_update_task
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

    METHODS build_cache_zero_result
      RETURNING VALUE(result) TYPE REF TO zif_mcp_ajson
      RAISING   zcx_mcp_ajson_error.

ENDCLASS.


CLASS zcl_mcp_test_v2 IMPLEMENTATION.
  METHOD get_implementation.
    result-name        = `ABAP MCP Draft V2 Test Server`.
    result-version     = `1.0.0`.
    result-title       = `Draft V2 Test Server`.
    result-description = `Raw HTTP test server for the draft stateless MCP protocol`.
  ENDMETHOD.

  METHOD get_capabilities.
    result-prompts       = abap_true.
    result-resources     = abap_true.
    result-tools         = abap_true.
    result-completions   = abap_true.
    result-tasks         = abap_true.
  ENDMETHOD.

  METHOD get_instructions.
    result = `Use this server for raw HTTP draft MCP protocol tests.`.
  ENDMETHOD.

  METHOD handle_tools_list.
    TRY.
        response-result = build_tools_result( ).
      CATCH zcx_mcp_ajson_error INTO DATA(json_error).
        response = json_error( json_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_tools_call.
    CASE request->get_name( ).
      WHEN `echo`.
        DATA(arguments) = request->get_arguments( ).
        DATA(message) = arguments->get_string( `/message` ).
        IF message IS INITIAL.
          message = `echo`.
        ENDIF.

        TRY.
            response-result = build_text_tool_result( message ).
          CATCH zcx_mcp_ajson_error INTO DATA(json_error).
            response = json_error( json_error ).
        ENDTRY.

      WHEN `header_string`.
        TRY.
            DATA(args_string) = request->get_arguments( ).
            response-result = build_text_tool_result( |header string: { args_string->get_string( `/value` ) }| ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN `header_integer`.
        TRY.
            DATA(args_integer) = request->get_arguments( ).
            response-result = build_text_tool_result( |header integer: { args_integer->get_integer( `/count` ) }| ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN `header_boolean`.
        TRY.
            DATA(args_boolean) = request->get_arguments( ).
            DATA(enabled_text) = COND string( WHEN args_boolean->get_boolean( `/enabled` ) = abap_true
                                              THEN `true`
                                              ELSE `false` ).
            response-result = build_text_tool_result( |header boolean: { enabled_text }| ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.
      WHEN `needs_input`.
        IF request->is_retry( ) = abap_true.
          DATA input_responses TYPE REF TO zif_mcp_ajson.
          DATA elicitation     TYPE REF TO zcl_mcp_elicit_result.
          DATA state           TYPE zcl_mcp_req_state=>state_data.
          DATA approved        TYPE abap_bool.
          DATA approved_text   TYPE string.

          TRY.
              state = validate_request_state( request->get_request_state( ) ).

              input_responses = request->get_input_responses( ).
              elicitation = NEW zcl_mcp_elicit_result( input_responses->slice( `/confirm` ) ).

              IF elicitation->is_accept( ) = abap_true.
                approved = elicitation->get_boolean( `approved` ).
              ENDIF.

              IF approved = abap_true.
                approved_text = `true`.
              ELSE.
                approved_text = `false`.
              ENDIF.

              response-result = build_text_tool_result( |Tool retry accepted: { state-data } approved={ approved_text }| ).

            CATCH zcx_mcp_ajson_error INTO json_error.
              response = json_error( json_error ).

            CATCH zcx_mcp_server INTO DATA(mcp_error).
              response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
              response-error-message = mcp_error->get_text( ).
          ENDTRY.
          RETURN.
        ENDIF.

        TRY.
            response-result = build_input_required( ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).

          CATCH zcx_mcp_server INTO mcp_error.
            response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
            response-error-message = mcp_error->get_text( ).
        ENDTRY.
      WHEN `start_task`.
        DATA(context) = me->zif_mcp_server_v2~get_v2_context( ).
        IF    context-extensions IS NOT BOUND
           OR context-extensions->exists( `/io.modelcontextprotocol~1tasks` )  = abap_false.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-missing_client_capability.
          response-error-message = `Client did not declare io.modelcontextprotocol/tasks.`.

          TRY.
              response-error-data = zcl_mcp_ajson=>create_empty( ).
              response-error-data->touch_array( `/requiredCapabilities` ).
              response-error-data->set_string( iv_path = `/requiredCapabilities/1`
                                               iv_val  = zif_mcp_constants=>extensions-tasks ).
            CATCH zcx_mcp_ajson_error.
              CLEAR response-error-data.
          ENDTRY.

          RETURN.
        ENDIF.

        TRY.
            response-result = build_task_result( ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN c_unguarded_task_tool.
        TRY.
            response-result = build_task_result( ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN c_persisted_task_tool.
        DATA(context_persisted) = me->zif_mcp_server_v2~get_v2_context( ).
        IF    context_persisted-extensions IS NOT BOUND
           OR context_persisted-extensions->exists( `/io.modelcontextprotocol~1tasks` )  = abap_false.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-missing_client_capability.
          response-error-message = `Client did not declare io.modelcontextprotocol/tasks.`.

          TRY.
              response-error-data = zcl_mcp_ajson=>create_empty( ).
              response-error-data->touch_array( `/requiredCapabilities` ).
              response-error-data->set_string( iv_path = `/requiredCapabilities/1`
                                               iv_val  = zif_mcp_constants=>extensions-tasks ).
            CATCH zcx_mcp_ajson_error.
              CLEAR response-error-data.
          ENDTRY.

          RETURN.
        ENDIF.

        TRY.
            DATA(tasks) = get_tasks( ).
            DATA(task_id) = tasks->create_task( tool_name     = c_persisted_task_tool
                                                poll_interval = 1000 ).

            " TODO: variable is assigned but never used (ABAP cleaner)
            DATA(task_get) = NEW zcl_mcp_resp_v2_task_get( ).
            DATA(builder_persisted) = NEW zcl_mcp_schema_builder( ).
            DATA(input_request) = NEW zcl_mcp_input_elicitation( ).

            builder_persisted->add_boolean( name        = `approved`
                                            description = `Whether the task should continue.`
                                            required    = abap_true ).

            input_request->set_form( message          = `Confirm persisted task continuation.`
                                     requested_schema = builder_persisted->to_json( ) ).

            DATA(pending) = zcl_mcp_ajson=>create_empty( ).
            pending->set_string( iv_path = `/requestState`
                                 iv_val  = create_request_state( data        = `persisted-task-input`
                                                                 ttl_seconds = 300 ) ).
            pending->set_string( iv_path = `/inputRequests/confirm/method`
                                 iv_val  = input_request->get_method( ) ).
            pending->set( iv_path = `/inputRequests/confirm/params`
                          iv_val  = input_request->get_params( ) ).

            zcl_mcp_tasks=>request_input( task_id        = task_id
                                          input_required = pending ).

            DATA(task_result) = NEW zcl_mcp_resp_v2_task( ).
            task_result->set_task( task_id          = CONV #( task_id )
                                   status           = zif_mcp_types=>task_states-input_required
                                   status_message   = `Task is waiting for client input.`
                                   poll_interval_ms = 1000 ).

            response-result = task_result->zif_mcp_modern_result~generate_json( ).

          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).

          CATCH zcx_mcp_server INTO mcp_error.
            response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
            response-error-message = mcp_error->get_text( ).
        ENDTRY.

      WHEN `cache_meta`.
        TRY.
            response-result = build_cache_meta_result( ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN `cache_zero`.
        TRY.
            response-result = build_cache_zero_result( ).
          CATCH zcx_mcp_ajson_error INTO json_error.
            response = json_error( json_error ).
        ENDTRY.

      WHEN OTHERS.
        response = method_not_found( request->get_name( ) ).
    ENDCASE.
  ENDMETHOD.

  METHOD handle_tasks_get.
    TRY.
        CASE request->get_task_id( ).
          WHEN c_task_id.
            response-result = build_task_get_result( ).

          WHEN c_task_input_id.
            response-result = build_task_input_req_result( ).

          WHEN c_task_error_id.
            response-result = build_task_error_result( ).

          WHEN OTHERS.
            response = super->handle_tasks_get( request ).
        ENDCASE.
      CATCH zcx_mcp_ajson_error INTO DATA(json_error).
        response = json_error( json_error ).

      CATCH zcx_mcp_server INTO DATA(mcp_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
        response-error-message = mcp_error->get_text( ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_tasks_update.
    DATA state TYPE zcl_mcp_req_state=>state_data.

    IF request->get_task_id( ) <> c_task_id AND request->get_task_id( ) <> c_task_input_id.
      response = super->handle_tasks_update( request ).
      RETURN.
    ENDIF.

    TRY.
        state = validate_request_state( request_state = request->get_request_state( )
                                        method        = `tasks/get` ).

        IF state-data <> `task-input`.
          response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
          response-error-message = `Unexpected task requestState.`.
          RETURN.
        ENDIF.

        response-result = build_task_update_result( request ).

      CATCH zcx_mcp_ajson_error INTO DATA(json_error).
        response = json_error( json_error ).

      CATCH zcx_mcp_server INTO DATA(mcp_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = mcp_error->get_text( ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_tasks_cancel.
    IF request->get_task_id( ) <> c_task_id.
      response = super->handle_tasks_cancel( request ).
      RETURN.
    ENDIF.

    TRY.
        DATA(task_get) = NEW zcl_mcp_resp_v2_task_get( ).

        task_get->set_task( task_id        = c_task_id
                            status         = zif_mcp_types=>task_states-cancelled
                            status_message = `Task cancelled.` ).

        response-result = task_get->zif_mcp_modern_result~generate_json( ).

      CATCH zcx_mcp_ajson_error INTO DATA(json_error).
        response = json_error( json_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD json_error.
    response-error-code    = zcl_mcp_jsonrpc=>error_codes-internal_error.
    response-error-message = error->get_text( ).
  ENDMETHOD.

  METHOD build_tools_result.
    DATA list_tools TYPE REF TO zcl_mcp_resp_list_tools.
    DATA tools      TYPE zcl_mcp_resp_list_tools=>tools.
    DATA tool       TYPE zcl_mcp_resp_list_tools=>tool.
    DATA schema     TYPE REF TO zif_mcp_ajson.
    DATA builder    TYPE REF TO zcl_mcp_schema_builder.

    list_tools = NEW zcl_mcp_resp_list_tools( ).

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_string( name         = `message`
                         description  = `Message to echo.`
                         x_mcp_header = `Message` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `echo`.
    tool-title        = `Echo`.
    tool-description  = `Return the supplied message.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_string( name         = `value`
                         x_mcp_header = `Value` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `header_string`.
    tool-title        = `Header String`.
    tool-description  = `String Mcp-Param header normalization test.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_integer( name         = `count`
                          x_mcp_header = `Count` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `header_integer`.
    tool-title        = `Header Integer`.
    tool-description  = `Integer Mcp-Param header normalization test.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_boolean( name         = `enabled`
                          x_mcp_header = `Enabled` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `header_boolean`.
    tool-title        = `Header Boolean`.
    tool-description  = `Boolean Mcp-Param header normalization test.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `needs_input`.
    tool-title        = `Needs Input`.
    tool-description  = `Returns an MRTR input_required result.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `start_task`.
    tool-title        = `Start Task`.
    tool-description  = `Returns a task extension result.`.
    tool-input_schema = schema.
    tool-execution-task_support = zcl_mcp_resp_list_tools=>task_support-optional.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = c_unguarded_task_tool.
    tool-title        = `Start Unguarded Task`.
    tool-description  = `Returns a task result without an application-side capability check.`.
    tool-input_schema = schema.
    tool-execution-task_support = zcl_mcp_resp_list_tools=>task_support-optional.
    APPEND tool TO tools.

    CLEAR tool.
    tool-name         = c_persisted_task_tool.
    tool-title        = `Start Persisted Input Task`.
    tool-description  = `Creates a persisted task that waits for client input.`.
    tool-input_schema = schema.
    tool-execution-task_support = zcl_mcp_resp_list_tools=>task_support-optional.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `cache_meta`.
    tool-title        = `Cache Meta`.
    tool-description  = `Returns v2 cache hints and result metadata.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `cache_zero`.
    tool-title        = `Cache Zero`.
    tool-description  = `Returns v2 cache hints with ttlMs zero.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_string( name         = `first`
                         x_mcp_header = `Shared` ).
    builder->add_string( name         = `second`
                         x_mcp_header = `shared` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `bad_header_duplicate`.
    tool-title        = `Bad Header Duplicate`.
    tool-description  = `Invalid duplicate x-mcp-header test schema.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_string( name         = `value`
                         x_mcp_header = `Bad Header` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `bad_header_token`.
    tool-title        = `Bad Header Token`.
    tool-description  = `Invalid x-mcp-header token test schema.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_number( name         = `amount`
                         x_mcp_header = `Amount` ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `bad_header_number`.
    tool-title        = `Bad Header Number`.
    tool-description  = `Invalid number x-mcp-header test schema.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    builder = NEW zcl_mcp_schema_builder( ).
    DATA(nested_builder) = builder->begin_object( name = `outer` ).
    nested_builder->add_string( name         = `inner`
                                x_mcp_header = `Inner` ).
    nested_builder->end_object( ).
    schema = builder->to_json( ).

    CLEAR tool.
    tool-name         = `bad_header_nested`.
    tool-title        = `Bad Header Nested`.
    tool-description  = `Invalid nested x-mcp-header test schema.`.
    tool-input_schema = schema.
    APPEND tool TO tools.

    list_tools->set_tools( tools ).
    result = list_tools->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_text_tool_result.
    DATA(tool_result) = NEW zcl_mcp_resp_v2_tool( ).

    tool_result->set_complete( ).
    tool_result->set_error( abap_false ).
    tool_result->add_text_content( message ).

    result = tool_result->generate_json( ).
  ENDMETHOD.

  METHOD build_input_required.
    DATA input_required TYPE REF TO zcl_mcp_resp_v2_input_req.
    DATA params         TYPE REF TO zif_mcp_ajson.
    DATA builder        TYPE REF TO zcl_mcp_schema_builder.

    DATA elicitation    TYPE REF TO zcl_mcp_input_elicitation.

    input_required = NEW zcl_mcp_resp_v2_input_req( ).
    input_required->set_request_state( create_request_state( data        = `needs-input`
                                                             ttl_seconds = 300 ) ).

    builder = NEW zcl_mcp_schema_builder( ).
    builder->add_boolean( name        = `approved`
                          description = `Whether the action is approved.`
                          required    = abap_true ).

    elicitation = NEW zcl_mcp_input_elicitation( ).
    elicitation->set_form( message          = `Confirm the v2 test action.`
                           requested_schema = builder->to_json( ) ).

    input_required->add_input_request( request_key = `confirm`
                                       method      = elicitation->get_method( )
                                       params      = elicitation->get_params( ) ).

    result = input_required->zif_mcp_modern_result~generate_json( ).
  ENDMETHOD.

  METHOD build_task_result.
    DATA task_result TYPE REF TO zcl_mcp_resp_v2_task.

    task_result = NEW zcl_mcp_resp_v2_task( ).
    task_result->set_task( task_id          = c_task_id
                           status           = `working`
                           status_message   = `Task accepted by ABAP v2 test server.`
                           ttl_ms           = 60000
                           poll_interval_ms = 1000 ).

    result = task_result->zif_mcp_modern_result~generate_json( ).
  ENDMETHOD.

  METHOD build_task_get_result.
    DATA(task_get) = NEW zcl_mcp_resp_v2_task_get( ).
    DATA(tool_result) = NEW zcl_mcp_resp_v2_tool( ).

    tool_result->set_error( abap_false ).
    tool_result->add_text_content( `Task result from ABAP v2 test server.` ).

    task_get->set_task( task_id        = c_task_id
                        status         = `completed`
                        status_message = `Task completed.` ).
    task_get->set_result( tool_result->generate_json( ) ).

    result = task_get->zif_mcp_modern_result~generate_json( ).
  ENDMETHOD.

  METHOD handle_prompts_list.
    TRY.
        response-result = build_prompts_list_result( ).
      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_prompts_get.
    DATA topic TYPE string VALUE `ABAP`.

    TRY.
        IF request->is_retry( ) = abap_true.
          DATA retry_inputs TYPE REF TO zif_mcp_ajson.
          DATA elicitation  TYPE REF TO zcl_mcp_elicit_result.

          retry_inputs = request->get_input_responses( ).
          elicitation = NEW zcl_mcp_elicit_result( retry_inputs->slice( `/confirm` ) ).

          IF elicitation->is_accept( ) = abap_true.
            topic = elicitation->get_string( `topic` ).
          ENDIF.

          IF topic IS INITIAL.
            topic = request->get_request_state( ).
          ENDIF.

          response-result = build_prompt_get_result( topic ).
          RETURN.
        ENDIF.

        IF request->has_arguments( ) = abap_true.
          DATA(arguments) = request->get_arguments( ).
          READ TABLE arguments INTO DATA(argument) WITH KEY key = `topic`.
          IF sy-subrc = 0 AND argument-value IS NOT INITIAL.
            topic = argument-value.
          ENDIF.
        ENDIF.

        response-result = build_prompt_get_result( topic ).

      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).

      CATCH zcx_mcp_server INTO DATA(mcp_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = mcp_error->get_text( ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_resources_list.
    TRY.
        response-result = build_resources_result( ).
      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_res_tmpls_list.
    TRY.
        response-result = build_res_tmpls_result( ).
      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_resources_read.
    IF request->get_uri( ) <> `test://v2/resource`.
      response-error-code    = zcl_mcp_jsonrpc=>error_codes-resource_not_found.
      response-error-message = `Resource not found.`.
      RETURN.
    ENDIF.

    TRY.
        IF request->is_retry( ) = abap_true.
          DATA retry_inputs TYPE REF TO zif_mcp_ajson.
          DATA elicitation  TYPE REF TO zcl_mcp_elicit_result.
          DATA suffix       TYPE string.
          DATA retry_text   TYPE string.

          retry_inputs = request->get_input_responses( ).
          elicitation = NEW zcl_mcp_elicit_result( retry_inputs->slice( `/confirm` ) ).

          IF elicitation->is_accept( ) = abap_true.
            suffix = elicitation->get_string( `suffix` ).
          ENDIF.

          retry_text = |Resource retry accepted: { request->get_request_state( ) } suffix={ suffix }|.

          response-result = build_res_read_result( uri  = request->get_uri( )
                                                   text = retry_text ).
        ELSE.
          response-result = build_res_read_result( request->get_uri( ) ).
        ENDIF.

      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).

      CATCH zcx_mcp_server INTO DATA(mcp_error).
        response-error-code    = zcl_mcp_jsonrpc=>error_codes-invalid_params.
        response-error-message = mcp_error->get_text( ).
    ENDTRY.
  ENDMETHOD.

  METHOD handle_completion.
    TRY.
        response-result = build_completion_result( ).
      CATCH zcx_mcp_ajson_error INTO DATA(ajson_error).
        response = json_error( ajson_error ).
    ENDTRY.
  ENDMETHOD.

  METHOD build_prompts_list_result.
    DATA list_prompts TYPE REF TO zcl_mcp_resp_list_prompts.
    DATA prompts      TYPE zcl_mcp_resp_list_prompts=>prompts.
    DATA prompt       TYPE zcl_mcp_resp_list_prompts=>prompt.
    DATA argument     TYPE zcl_mcp_resp_list_prompts=>prompt_argument.

    list_prompts = NEW zcl_mcp_resp_list_prompts( ).

    CLEAR argument.
    argument-name         = `topic`.
    argument-description  = `Topic to include in the prompt.`.
    argument-required     = abap_false.
    argument-required_set = abap_true.

    CLEAR prompt.
    prompt-name        = `v2_prompt`.
    prompt-title       = `V2 Prompt`.
    prompt-description = `Prompt exposed by the draft v2 test server.`.
    APPEND argument TO prompt-arguments.
    APPEND prompt TO prompts.

    list_prompts->set_prompts( prompts ).
    result = list_prompts->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_prompt_get_result.
    DATA get_prompt TYPE REF TO zcl_mcp_resp_get_prompt.

    get_prompt = NEW zcl_mcp_resp_get_prompt( ).
    get_prompt->set_description( `Prompt exposed by the draft v2 test server.` ).
    get_prompt->add_text_message( role = zif_mcp_types=>role_user
                                  text = |Create a short response about { topic }.| ).

    result = get_prompt->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_resources_result.
    DATA list_resources TYPE REF TO zcl_mcp_resp_list_resources.
    DATA resources      TYPE zcl_mcp_resp_list_resources=>resources.
    DATA resource       TYPE zcl_mcp_resp_list_resources=>resource.

    list_resources = NEW zcl_mcp_resp_list_resources( ).

    resource-uri         = `test://v2/resource`.
    resource-name        = `v2-resource`.
    resource-title       = `V2 Resource`.
    resource-description = `Resource exposed by the draft v2 test server.`.
    resource-mime_type   = `text/plain`.
    APPEND resource TO resources.

    list_resources->set_resources( resources ).
    result = list_resources->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_res_tmpls_result.
    DATA list_templates TYPE REF TO zcl_mcp_resp_list_res_tmpl.
    DATA templates      TYPE zcl_mcp_resp_list_res_tmpl=>resource_templates.
    DATA template       TYPE zcl_mcp_resp_list_res_tmpl=>resource_template.

    list_templates = NEW zcl_mcp_resp_list_res_tmpl( ).

    template-uritemplate = `test://v2/{name}`.
    template-name        = `v2-template`.
    template-title       = `V2 Template`.
    template-description = `Resource template exposed by the draft v2 test server.`.
    template-mime_type   = `text/plain`.
    APPEND template TO templates.

    list_templates->set_resource_templates( templates ).
    result = list_templates->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_res_read_result.
    DATA read_resource TYPE REF TO zcl_mcp_resp_read_resource.
    DATA content_text  TYPE string.

    content_text = text.
    IF content_text IS INITIAL.
      content_text = `Resource content from ABAP v2 test server.`.
    ENDIF.

    read_resource = NEW zcl_mcp_resp_read_resource( ).
    read_resource->add_text_resource( uri       = uri
                                      text      = content_text
                                      mime_type = `text/plain` ).

    result = read_resource->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_completion_result.
    DATA complete TYPE REF TO zcl_mcp_resp_complete.

    complete = NEW zcl_mcp_resp_complete( ).
    complete->add_value( `draft` ).
    complete->add_value( `drilldown` ).
    complete->set_total( 2 ).
    complete->set_has_more( abap_false ).

    result = complete->zif_mcp_internal~generate_json( ).
  ENDMETHOD.

  METHOD build_cache_meta_result.
    DATA(tool_result) = NEW zcl_mcp_resp_v2_tool( ).
    DATA(meta) = zcl_mcp_ajson=>create_empty( ).

    meta->set_string( iv_path = `/abap.test~1trace`
                      iv_val  = `cache-meta` ).

    tool_result->set_complete( ).
    tool_result->set_error( abap_false ).
    tool_result->add_text_content( `Cacheable v2 result with metadata.` ).
    tool_result->set_cache( ttl_ms      = 2500
                            cache_scope = zif_mcp_constants=>cache_scopes-private ).
    tool_result->set_meta( meta ).

    result = tool_result->generate_json( ).
  ENDMETHOD.

  METHOD build_task_input_req_result.
    DATA task_get    TYPE REF TO zcl_mcp_resp_v2_task_get.
    DATA params      TYPE REF TO zif_mcp_ajson.
    DATA builder     TYPE REF TO zcl_mcp_schema_builder.

    DATA elicitation TYPE REF TO zcl_mcp_input_elicitation.

    task_get = NEW zcl_mcp_resp_v2_task_get( ).

    builder = NEW zcl_mcp_schema_builder( ).
    elicitation = NEW zcl_mcp_input_elicitation( ).
    elicitation->set_form( message          = `Confirm task continuation.`
                           requested_schema = builder->to_json( ) ).

    task_get->set_task( task_id        = c_task_input_id
                        status         = zif_mcp_types=>task_states-input_required
                        status_message = `Task is waiting for client input.` ).
    task_get->set_request_state( create_request_state( data        = `task-input`
                                                       ttl_seconds = 300 ) ).
    task_get->add_input_request( request_key = `confirm`
                                 method      = elicitation->get_method( )
                                 params      = elicitation->get_params( ) ).

    result = task_get->zif_mcp_modern_result~generate_json( ).
  ENDMETHOD.

  METHOD build_task_error_result.
    DATA(task_get) = NEW zcl_mcp_resp_v2_task_get( ).

    task_get->set_task( task_id        = c_task_error_id
                        status         = `failed`
                        status_message = `Task failed.` ).
    task_get->set_error( code    = zcl_mcp_jsonrpc=>error_codes-internal_error
                         message = `Task failed in ABAP v2 test server.` ).

    result = task_get->zif_mcp_modern_result~generate_json( ).
  ENDMETHOD.

  METHOD build_task_update_result.
    DATA ack TYPE REF TO zcl_mcp_resp_v2_ack.

    ack = NEW zcl_mcp_resp_v2_ack( ).
    ack->set_complete( ).

    result = ack->generate_json( ).
  ENDMETHOD.

  METHOD build_cache_zero_result.
    DATA(tool_result) = NEW zcl_mcp_resp_v2_tool( ).

    tool_result->set_complete( ).
    tool_result->set_error( abap_false ).
    tool_result->add_text_content( `Zero-cache v2 result.` ).
    tool_result->set_cache( ttl_ms      = 0
                            cache_scope = zif_mcp_constants=>cache_scopes-private ).

    result = tool_result->generate_json( ).
  ENDMETHOD.

  METHOD handle_tool_input_schema.
    DATA builder TYPE REF TO zcl_mcp_schema_builder.

    builder = NEW zcl_mcp_schema_builder( ).

    CASE tool_name.
      WHEN `echo`.
        builder->add_string( name         = `message`
                             description  = `Message to echo.`
                             x_mcp_header = `Message` ).

      WHEN `header_string`.
        builder->add_string( name         = `value`
                             x_mcp_header = `Value` ).

      WHEN `header_integer`.
        builder->add_integer( name         = `count`
                              x_mcp_header = `Count` ).

      WHEN `header_boolean`.
        builder->add_boolean( name         = `enabled`
                              x_mcp_header = `Enabled` ).

      WHEN `bad_header_duplicate`.
        builder->add_string( name         = `first`
                             x_mcp_header = `Shared` ).
        builder->add_string( name         = `second`
                             x_mcp_header = `shared` ).

      WHEN `bad_header_token`.
        builder->add_string( name         = `value`
                             x_mcp_header = `Bad Header` ).

      WHEN `bad_header_number`.
        builder->add_number( name         = `amount`
                             x_mcp_header = `Amount` ).

      WHEN `bad_header_nested`.
        DATA(nested_builder) = builder->begin_object( name = `outer` ).
        nested_builder->add_string( name         = `inner`
                                    x_mcp_header = `Inner` ).
        nested_builder->end_object( ).

      WHEN OTHERS.
        " Empty object schema.
    ENDCASE.

    result = builder->to_json( ).
  ENDMETHOD.
ENDCLASS.
