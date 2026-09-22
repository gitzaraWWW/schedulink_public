import { getErrorMessage, requestJson } from "../../../shared/api/http";

export async function searchMentions(query) {
  const { response, data } = await requestJson(
    `/auth/mentions/search?q=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "멘션 검색 결과를 불러오지 못했습니다.")
    );
  }

  return {
    results: data.results || [],
    teams: data.teams || [],
  };
}

export async function fetchTeamMembers(teamName) {
  const { response, data } = await requestJson(
    `/auth/mentions/team-members?team=${encodeURIComponent(teamName)}`
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "팀 멤버를 불러오지 못했습니다.")
    );
  }

  return {
    teamName: data.teamName || teamName,
    members: data.members || [],
  };
}
