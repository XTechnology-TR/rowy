import { lazy, Suspense, useState } from "react";
import _get from "lodash/get";
import stringify from "json-stable-stringify-without-jsonify";

import {
  Stepper,
  Step,
  StepButton,
  StepContent,
  Stack,
  Grid,
  TextField,
  FormControl,
  FormLabel,
  FormControlLabel,
  RadioGroup,
  Radio,
  Typography,
  InputLabel,
  Link,
  Checkbox,
  FormHelperText,
  Fab,
} from "@mui/material";
import ExpandIcon from "@mui/icons-material/KeyboardArrowDown";
import RunIcon from "@mui/icons-material/PlayArrow";
import RedoIcon from "@mui/icons-material/Refresh";
import UndoIcon from "@mui/icons-material/Undo";

import SteppedAccordion from "@src/components/SteppedAccordion";
import MultiSelect from "@rowy/multiselect";
import FieldSkeleton from "@src/components/SideDrawer/Form/FieldSkeleton";
import CodeEditorHelper from "@src/components/CodeEditor/CodeEditorHelper";
import InlineOpenInNewIcon from "@src/components/InlineOpenInNewIcon";
import FormFieldSnippets from "./FormFieldSnippets";

import { useProjectContext } from "@src/contexts/ProjectContext";
import { WIKI_LINKS } from "@src/constants/externalLinks";

const CodeEditor = lazy(
  () =>
    import("@src/components/CodeEditor" /* webpackChunkName: "CodeEditor" */)
);

const Settings = ({ config, onChange }) => {
  const { tableState, roles } = useProjectContext();

  const [activeStep, setActiveStep] = useState<
    "requirements" | "friction" | "action" | "undo" | "customization"
  >("requirements");
  const steps =
    config.isActionScript && _get(config, "undo.enabled")
      ? ["requirements", "friction", "action", "undo", "customization"]
      : ["requirements", "friction", "action", "customization"];

  const columnOptions = Object.values(tableState?.columns ?? {}).map((c) => ({
    label: c.name,
    value: c.key,
  }));

  const formattedParamsJson = stringify(
    Array.isArray(config.params) ? config.params : [],
    { space: 2 }
  );
  const [codeValid, setCodeValid] = useState(true);

  const scriptExtraLibs = [
    [
      "declare class ref {",
      "    /**",
      "     * Reference object of the row running the action script",
      "     */",
      "static id:string",
      "static path:string",
      "static parentId:string",
      "static tablePath:string",
      "}",
    ].join("\n"),
    [
      "declare class actionParams {",
      "    /**",
      "     * actionParams are provided by dialog popup form",
      "     */",
      (config.params ?? []).filter(Boolean).map((param) => {
        const validationKeys = Object.keys(param.validation ?? {});
        if (validationKeys.includes("string")) {
          return `static ${param.name}: string`;
        } else if (validationKeys.includes("array")) {
          return `static ${param.name}: any[]`;
        } else return `static ${param.name}: any`;
      }),
      "}",
    ].join("\n"),
  ];

  // Backwards-compatibility: previously user could set `confirmation` without
  // having to set `friction: confirmation`
  const showConfirmationField =
    config.friction === "confirmation" ||
    (!config.friction &&
      typeof config.confirmation === "string" &&
      config.confirmation !== "");

  return (
    <SteppedAccordion
      steps={[
        {
          id: "requirements",
          title: "Requirements",
          content: (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <MultiSelect
                  label="Required roles"
                  options={roles ?? []}
                  value={config.requiredRoles ?? []}
                  onChange={onChange("requiredRoles")}
                  TextFieldProps={{
                    id: "requiredRoles",
                    helperText:
                      "The user must have at least one of these roles to run the script",
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <MultiSelect
                  label="Required fields"
                  options={columnOptions}
                  value={config.requiredFields ?? []}
                  onChange={onChange("requiredFields")}
                  TextFieldProps={{
                    id: "requiredFields",
                    helperText:
                      "All the selected fields must have a value for the script to run",
                  }}
                />
              </Grid>
            </Grid>
          ),
        },
        {
          id: "confirmation",
          title: "Confirmation",
          content: (
            <Stack spacing={3}>
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  Clicking the action button will:
                </FormLabel>

                <RadioGroup
                  aria-label="Action button friction"
                  name="friction"
                  defaultValue={
                    typeof config.confirmation === "string" &&
                    config.confirmation !== ""
                      ? "confirmation"
                      : "none"
                  }
                  value={config.friction}
                  onChange={(e) => onChange("friction")(e.target.value)}
                >
                  <FormControlLabel
                    value="none"
                    control={<Radio />}
                    label="Run the action immediately"
                  />
                  <FormControlLabel
                    value="confirmation"
                    control={<Radio />}
                    label="Ask the user for confirmation"
                  />
                  <FormControlLabel
                    value="params"
                    control={<Radio />}
                    label={
                      <>
                        <Typography variant="inherit">
                          Ask the user for input in a form (Alpha)
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          This feature is currently undocumented and is subject
                          to change in future minor versions
                        </Typography>
                      </>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {showConfirmationField && (
                <TextField
                  id="confirmation"
                  label="Confirmation template"
                  placeholder="Are sure you want to invest {{stockName}}?"
                  value={config.confirmation}
                  onChange={(e) => onChange("confirmation")(e.target.value)}
                  fullWidth
                  helperText="The action button will not ask for confirmation if this is left empty"
                />
              )}

              {config.friction === "params" && (
                <FormControl>
                  <Grid container spacing={1} sx={{ mb: 0.5 }}>
                    <Grid item xs>
                      <InputLabel variant="filled">Form fields</InputLabel>
                    </Grid>
                    <Grid item>
                      <FormFieldSnippets />
                    </Grid>
                  </Grid>

                  <Suspense fallback={<FieldSkeleton height={300} />}>
                    <CodeEditor
                      minHeight={200}
                      defaultLanguage="json"
                      value={formattedParamsJson}
                      onChange={(v) => {
                        try {
                          if (v) {
                            const parsed = JSON.parse(v);
                            onChange("params")(parsed);
                          }
                        } catch (e) {
                          console.log(`Failed to parse JSON: ${e}`);
                          setCodeValid(false);
                        }
                      }}
                      onValidStatusUpdate={({ isValid }) =>
                        setCodeValid(isValid)
                      }
                      error={!codeValid}
                    />
                  </Suspense>

                  {!codeValid && (
                    <FormHelperText error variant="filled">
                      Invalid JSON
                    </FormHelperText>
                  )}
                </FormControl>
              )}
            </Stack>
          ),
        },
        {
          id: "action",
          title: "Action",
          content: (
            <Stack spacing={3}>
              <FormControl component="fieldset">
                <FormLabel component="legend">
                  Clicking the action button will run a:
                </FormLabel>
                <RadioGroup
                  aria-label="Action will run"
                  name="isActionScript"
                  value={
                    config.isActionScript ? "actionScript" : "cloudFunction"
                  }
                  onChange={(e) =>
                    onChange("isActionScript")(
                      e.target.value === "actionScript"
                    )
                  }
                >
                  <FormControlLabel
                    value="actionScript"
                    control={<Radio />}
                    label={
                      <>
                        <Typography variant="inherit">Script</Typography>
                        <Typography variant="caption" color="textSecondary">
                          Write JavaScript code below that will be executed by
                          Rowy Run.{" "}
                          <Link
                            href={WIKI_LINKS.rowyRun}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Requires Rowy Run setup
                            <InlineOpenInNewIcon />
                          </Link>
                        </Typography>
                      </>
                    }
                  />
                  <FormControlLabel
                    value="cloudFunction"
                    control={<Radio />}
                    label={
                      <>
                        <Typography variant="inherit">Callable</Typography>
                        <Typography variant="caption" color="textSecondary">
                          A{" "}
                          <Link
                            href="https://firebase.google.com/docs/functions/callable"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            callable function
                            <InlineOpenInNewIcon />
                          </Link>{" "}
                          you’ve deployed on your Firestore or Google Cloud
                          project
                        </Typography>
                      </>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {!config.isActionScript ? (
                <TextField
                  id="callableName"
                  label="Callable name"
                  name="callableName"
                  value={config.callableName}
                  fullWidth
                  onChange={(e) => onChange("callableName")(e.target.value)}
                  helperText={
                    <>
                      Write the name of the callable function you’ve deployed to
                      your project.{" "}
                      <Link
                        href={`https://console.firebase.google.com/project/rowyio/functions/list`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View your callable functions
                        <InlineOpenInNewIcon />
                      </Link>
                      <br />
                      Your callable function must be compatible with Rowy Action
                      columns.{" "}
                      <Link
                        href={WIKI_LINKS.fieldTypesAction + "#callable"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View requirements
                        <InlineOpenInNewIcon />
                      </Link>
                    </>
                  }
                />
              ) : (
                <>
                  <FormControl>
                    <InputLabel variant="filled">Action script</InputLabel>
                    <Suspense fallback={<FieldSkeleton height={300} />}>
                      <CodeEditor
                        minHeight={200}
                        value={config.script}
                        onChange={onChange("script")}
                        extraLibs={scriptExtraLibs}
                      />
                    </Suspense>
                    <CodeEditorHelper
                      docLink={WIKI_LINKS.fieldTypesAction + "#script"}
                      additionalVariables={[]}
                    />
                  </FormControl>

                  <Grid container>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={config.redo?.enabled}
                            onChange={() =>
                              onChange("redo.enabled")(
                                !Boolean(config.redo?.enabled)
                              )
                            }
                            name="redo"
                          />
                        }
                        label={
                          <>
                            <Typography variant="inherit">
                              User can redo
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Re-runs the script above
                            </Typography>
                          </>
                        }
                        style={{ marginLeft: -11 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={config.undo?.enabled}
                            onChange={() =>
                              onChange("undo.enabled")(
                                !Boolean(config.undo?.enabled)
                              )
                            }
                            name="undo"
                          />
                        }
                        label={
                          <>
                            <Typography variant="inherit">
                              User can undo
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Runs a new script
                            </Typography>
                          </>
                        }
                        style={{ marginLeft: -11 }}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </Stack>
          ),
        },
        config.isActionScript &&
          _get(config, "undo.enabled") && {
            id: "undo",
            title: "Undo action",
            content: (
              <Stack spacing={3}>
                {(showConfirmationField ||
                  !config.friction ||
                  config.friction === "none") && (
                  <TextField
                    id="undo.confirmation"
                    label="Undo confirmation template"
                    placeholder="Are you sure you want to sell your stocks in {{stockName}}?"
                    value={_get(config, "undo.confirmation")}
                    onChange={(e) => {
                      onChange("undo.confirmation")(e.target.value);
                    }}
                    fullWidth
                    helperText={
                      <>
                        {showConfirmationField &&
                          "Override the confirmation message above. "}
                        The action button will not ask for confirmation if this
                        is left empty{showConfirmationField && "."}
                      </>
                    }
                  />
                )}

                <FormControl>
                  <InputLabel variant="filled">Undo script</InputLabel>
                  <Suspense fallback={<FieldSkeleton height={300} />}>
                    <CodeEditor
                      value={_get(config, "undo.script")}
                      onChange={onChange("undo.script")}
                      extraLibs={scriptExtraLibs}
                    />
                  </Suspense>
                  <CodeEditorHelper
                    docLink={WIKI_LINKS.fieldTypesAction + "#script"}
                    additionalVariables={[]}
                  />
                </FormControl>
              </Stack>
            ),
          },
        {
          id: "customization",
          title: "Customization",
          content: (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.customIcons?.enabled}
                    onChange={(e) =>
                      onChange("customIcons.enabled")(e.target.checked)
                    }
                    name="customIcons.enabled"
                  />
                }
                label="Customize button icons with emoji"
                style={{ marginLeft: -11 }}
              />

              {config.customIcons?.enabled && (
                <Grid container spacing={2} sx={{ mt: { xs: 0, sm: -1 } }}>
                  <Grid item xs={12} sm={true}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        id="customIcons.run"
                        value={_get(config, "customIcons.run")}
                        onChange={(e) =>
                          onChange("customIcons.run")(e.target.value)
                        }
                        label="Run:"
                        className="labelHorizontal"
                        inputProps={{ style: { width: "3ch" } }}
                      />
                      <Fab size="small" aria-label="Preview of run button">
                        {_get(config, "customIcons.run") || <RunIcon />}
                      </Fab>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm={true}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        id="customIcons.redo"
                        value={_get(config, "customIcons.redo")}
                        onChange={(e) =>
                          onChange("customIcons.redo")(e.target.value)
                        }
                        label="Redo:"
                        className="labelHorizontal"
                        inputProps={{ style: { width: "3ch" } }}
                      />
                      <Fab size="small" aria-label="Preview of redo button">
                        {_get(config, "customIcons.redo") || <RedoIcon />}
                      </Fab>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm={true}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        id="customIcons.undo"
                        value={_get(config, "customIcons.undo")}
                        onChange={(e) =>
                          onChange("customIcons.undo")(e.target.value)
                        }
                        label="Undo:"
                        className="labelHorizontal"
                        inputProps={{ style: { width: "3ch" } }}
                      />
                      <Fab size="small" aria-label="Preview of undo button">
                        {_get(config, "customIcons.undo") || <UndoIcon />}
                      </Fab>
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </>
          ),
        },
      ].filter(Boolean)}
    />
  );
};
export default Settings;
