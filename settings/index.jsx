function settingsComponent(props) {
  let calendars = null;
  try {
    calendars = JSON.parse(props.settingsStorage.getItem('calendars'));
  } catch (e) {
    console.log(e);
  }
  return (
    <Page>
      <Section
        title={
          <Text bold align="center">
            General Options
          </Text>
        }
      >
        <Toggle
          settingsKey={"timeline_hide_allday"}
          label="Hide all day events" />
        <Toggle
          settingsKey={"timeline_hide_declined"}
          label="Hide declined events" />
      </Section>
      <Section title="Calendars">
        {calendars !== null ? calendars.map(calendar => <Section>
          <Toggle
            settingsKey={"cal:" + calendar["title"] + ':enabled'}
            label={calendar["title"]}
          />
          {props.settingsStorage.getItem("cal:" + calendar["title"] + ':enabled') === "true" &&
            <ColorSelect
              centered={true}
              settingsKey={"cal:" + calendar["title"] + ':color'}
              colors={[
                { color: 'white' },
                { color: 'tomato' },
                { color: 'sandybrown' },
                { color: 'gold' },
                { color: 'lightgreen' },
                { color: 'aquamarine' },
                { color: 'deepskyblue' },
                { color: 'plum' }
              ]}
            />
          }
        </Section>) : <Text bold align="center">
          Calendars have not yet been imported. This should happen in a few seconds. Please try closing this Settings page, and then re-opening.
        </Text>}
      </Section>
    </Page>
  );
}

registerSettingsPage(settingsComponent);
