function settingsComponent(props) {
  let calendars = JSON.parse(props.settingsStorage.getItem('calendars'));
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
      {calendars.map(calendar => <Section>
        <Toggle
          settingsKey={"cal:" + calendar["title"] + ':enabled'}
          label={calendar["title"]}
        />
        {props.settingsStorage.getItem("cal:" + calendar["title"] + ':enabled') === "true" &&
          <ColorSelect
            centered={true}
            settingsKey={"cal:" + calendar["title"] + ':color'} 
            colors={[
              {color: 'white'},
              {color: 'tomato'},
              {color: 'sandybrown'},
              {color: 'gold'},
              {color: 'aquamarine'},
              {color: 'deepskyblue'},
              {color: 'plum'}
            ]}
            onSelection={(value) => console.log(value)}
          />
        }
      </Section>)}
      </Section>
    </Page>
  );
}

registerSettingsPage(settingsComponent);
